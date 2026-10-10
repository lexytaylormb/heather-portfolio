const fs = require("fs");
const path = require("path");

const text = process.argv[2] || "https://scanmetee.com/demo";
const outFile = process.argv[3] || path.join(__dirname, "..", "sample-scanme-qr.svg");

const VERSION = 2;
const SIZE = 21 + (VERSION - 1) * 4;
const DATA_CODEWORDS = 34;
const EC_CODEWORDS = 10;

function makeMatrix(size) {
  return Array.from({ length: size }, () => Array(size).fill(false));
}

function makeReserved(size) {
  return Array.from({ length: size }, () => Array(size).fill(false));
}

const modules = makeMatrix(SIZE);
const reserved = makeReserved(SIZE);

function setModule(row, col, value, isReserved = true) {
  if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) return;
  modules[row][col] = value;
  if (isReserved) reserved[row][col] = true;
}

function drawFinder(row, col) {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const rr = row + r;
      const cc = col + c;
      if (rr < 0 || rr >= SIZE || cc < 0 || cc >= SIZE) continue;
      const inFinder = r >= 0 && r <= 6 && c >= 0 && c <= 6;
      const dark = inFinder && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
      setModule(rr, cc, dark);
    }
  }
}

function drawAlignment(row, col) {
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const dark = Math.max(Math.abs(r), Math.abs(c)) !== 1;
      setModule(row + r, col + c, dark);
    }
  }
}

drawFinder(0, 0);
drawFinder(0, SIZE - 7);
drawFinder(SIZE - 7, 0);
drawAlignment(18, 18);

for (let i = 8; i < SIZE - 8; i++) {
  setModule(6, i, i % 2 === 0);
  setModule(i, 6, i % 2 === 0);
}

setModule(4 * VERSION + 9, 8, true);

for (let i = 0; i < 9; i++) {
  if (i !== 6) {
    reserved[8][i] = true;
    reserved[i][8] = true;
  }
}
for (let i = 0; i < 8; i++) {
  reserved[8][SIZE - 1 - i] = true;
  reserved[SIZE - 1 - i][8] = true;
}

function appendBits(bits, value, length) {
  for (let i = length - 1; i >= 0; i--) bits.push(((value >>> i) & 1) === 1);
}

const bytes = Array.from(Buffer.from(text, "utf8"));
if (bytes.length > 32) {
  throw new Error("Sample QR text is too long for this simple Version 2-L generator.");
}

const bits = [];
appendBits(bits, 0b0100, 4);
appendBits(bits, bytes.length, 8);
for (const byte of bytes) appendBits(bits, byte, 8);
appendBits(bits, 0, Math.min(4, DATA_CODEWORDS * 8 - bits.length));
while (bits.length % 8 !== 0) bits.push(false);

const data = [];
for (let i = 0; i < bits.length; i += 8) {
  let byte = 0;
  for (let j = 0; j < 8; j++) byte = (byte << 1) | (bits[i + j] ? 1 : 0);
  data.push(byte);
}
for (let pad = 0xec; data.length < DATA_CODEWORDS; pad = pad === 0xec ? 0x11 : 0xec) {
  data.push(pad);
}

const EXP = Array(512).fill(0);
const LOG = Array(256).fill(0);
let x = 1;
for (let i = 0; i < 255; i++) {
  EXP[i] = x;
  LOG[x] = i;
  x <<= 1;
  if (x & 0x100) x ^= 0x11d;
}
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];

function gfMul(a, b) {
  return a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]];
}

function generatorPoly(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gfMul(poly[j], EXP[i]);
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly;
}

function reedSolomon(dataWords, degree) {
  const gen = generatorPoly(degree);
  const rem = Array(degree).fill(0);
  for (const word of dataWords) {
    const factor = word ^ rem.shift();
    rem.push(0);
    for (let i = 0; i < degree; i++) rem[i] ^= gfMul(gen[i], factor);
  }
  return rem;
}

const codewords = data.concat(reedSolomon(data, EC_CODEWORDS));
const stream = [];
for (const word of codewords) appendBits(stream, word, 8);

let bitIndex = 0;
let upward = true;
for (let col = SIZE - 1; col > 0; col -= 2) {
  if (col === 6) col--;
  for (let i = 0; i < SIZE; i++) {
    const row = upward ? SIZE - 1 - i : i;
    for (let offset = 0; offset < 2; offset++) {
      const c = col - offset;
      if (reserved[row][c]) continue;
      let value = stream[bitIndex++] || false;
      if ((row + c) % 2 === 0) value = !value;
      setModule(row, c, value, false);
    }
  }
  upward = !upward;
}

function formatBits(ecLevelBits, mask) {
  let dataBits = (ecLevelBits << 3) | mask;
  let value = dataBits << 10;
  const generator = 0x537;
  for (let i = 14; i >= 10; i--) {
    if ((value >>> i) & 1) value ^= generator << (i - 10);
  }
  return ((dataBits << 10) | value) ^ 0x5412;
}

const fmt = formatBits(0b01, 0);
for (let i = 0; i <= 5; i++) setModule(8, i, ((fmt >>> i) & 1) === 1);
setModule(8, 7, ((fmt >>> 6) & 1) === 1);
setModule(8, 8, ((fmt >>> 7) & 1) === 1);
setModule(7, 8, ((fmt >>> 8) & 1) === 1);
for (let i = 9; i < 15; i++) setModule(14 - i, 8, ((fmt >>> i) & 1) === 1);
for (let i = 0; i < 8; i++) setModule(SIZE - 1 - i, 8, ((fmt >>> i) & 1) === 1);
for (let i = 8; i < 15; i++) setModule(8, SIZE - 15 + i, ((fmt >>> i) & 1) === 1);

const quiet = 4;
const scale = 12;
const svgSize = (SIZE + quiet * 2) * scale;
let rects = "";
for (let r = 0; r < SIZE; r++) {
  for (let c = 0; c < SIZE; c++) {
    if (modules[r][c]) {
      rects += `<rect x="${(c + quiet) * scale}" y="${(r + quiet) * scale}" width="${scale}" height="${scale}"/>`;
    }
  }
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}" role="img" aria-label="ScanMe Tee sample QR code">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <g fill="#111111">${rects}</g>
</svg>
`;

fs.writeFileSync(outFile, svg);
console.log(`Created ${outFile}`);
console.log(`QR destination: ${text}`);
