const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;

gsap.registerPlugin(ScrollTrigger);

const body = document.body;
const themeToggle = document.getElementById("themeToggle");
const menuToggle = document.getElementById("menuToggle");
const mobileMenu = document.getElementById("mobileMenu");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const ctaButtons = Array.from(document.querySelectorAll(".hero-actions a, .contact-links a"));
const audioPrompt = document.getElementById("audioPrompt");
const audioPromptYes = document.getElementById("audioPromptYes");
const audioPromptNo = document.getElementById("audioPromptNo");
const introSong = document.createElement("audio");
const introSongChoiceKey = "introSongChoice";

introSong.src = "images/Create%20Our%20Way.mp3";
introSong.preload = "auto";
introSong.loop = false;

const beatState = {
  context: null,
  started: false,
  fallbackHandlers: [],
  loopTimer: null
};

const setTheme = (theme) => {
  body.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
};

const toggleMenu = (shouldOpen) => {
  const isOpen = typeof shouldOpen === "boolean" ? shouldOpen : !mobileMenu.classList.contains("active");
  mobileMenu.classList.toggle("active", isOpen);
  menuToggle.classList.toggle("active", isOpen);
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  body.classList.toggle("menu-open", isOpen);
};

const initThemeToggle = () => {
  setTheme(localStorage.getItem("theme") || "dark");

  themeToggle.addEventListener("click", () => {
    const newTheme = body.getAttribute("data-theme") === "dark" ? "light" : "dark";
    setTheme(newTheme);

    if (!prefersReducedMotion) {
      gsap.fromTo(
        themeToggle,
        { scale: 1 },
        { scale: 0.94, duration: 0.14, yoyo: true, repeat: 1, ease: "power2.inOut" }
      );
    }
  });
};

const initMenu = () => {
  menuToggle.addEventListener("click", () => {
    toggleMenu();
  });

  document.querySelectorAll(".mobile-menu a, .nav-links a").forEach((link) => {
    link.addEventListener("click", () => {
      toggleMenu(false);
    });
  });
};

const initCtaSelection = () => {
  if (ctaButtons.length === 0) {
    return;
  }

  ctaButtons.forEach((button) => {
    button.addEventListener("click", () => {
      ctaButtons.forEach((otherButton) => otherButton.classList.remove("is-selected"));
      button.classList.add("is-selected");
    });
  });
};

const hideAudioPrompt = () => {
  if (!audioPrompt) {
    return;
  }

  audioPrompt.hidden = true;
  audioPrompt.classList.remove("is-visible");
};

const showAudioPrompt = () => {
  if (!audioPrompt) {
    return;
  }

  audioPrompt.hidden = false;

  window.requestAnimationFrame(() => {
    audioPrompt.classList.add("is-visible");
  });
};

const playIntroSongOnce = async () => {
  try {
    introSong.currentTime = 0;
    await introSong.play();
  } catch (error) {
    void error;
  }
};

const initIntroSongChoice = () => {
  if (!audioPrompt || !audioPromptYes || !audioPromptNo) {
    return;
  }

  if (sessionStorage.getItem(introSongChoiceKey)) {
    hideAudioPrompt();
    return;
  }

  introSong.addEventListener("ended", hideAudioPrompt, { once: true });

  audioPromptYes.addEventListener("click", async () => {
    sessionStorage.setItem(introSongChoiceKey, "yes");
    hideAudioPrompt();
    audioPromptYes.disabled = true;
    audioPromptNo.disabled = true;
    await playIntroSongOnce();
  });

  audioPromptNo.addEventListener("click", () => {
    sessionStorage.setItem(introSongChoiceKey, "no");
    hideAudioPrompt();
  });

  showAudioPrompt();
};

const createNoiseBuffer = (context) => {
  const duration = 1;
  const buffer = context.createBuffer(1, context.sampleRate * duration, context.sampleRate);
  const data = buffer.getChannelData(0);

  for (let index = 0; index < data.length; index += 1) {
    data[index] = Math.random() * 2 - 1;
  }

  return buffer;
};

const playKick = (context, output, time) => {
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(135, time);
  oscillator.frequency.exponentialRampToValueAtTime(48, time + 0.16);

  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.9, time + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.24);

  oscillator.connect(gain).connect(output);
  oscillator.start(time);
  oscillator.stop(time + 0.28);
};

const playSnare = (context, output, time, noiseBuffer) => {
  const noiseSource = context.createBufferSource();
  const bandPass = context.createBiquadFilter();
  const gain = context.createGain();

  noiseSource.buffer = noiseBuffer;
  bandPass.type = "bandpass";
  bandPass.frequency.setValueAtTime(1800, time);
  bandPass.Q.value = 0.8;

  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.5, time + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);

  noiseSource.connect(bandPass).connect(gain).connect(output);
  noiseSource.start(time);
  noiseSource.stop(time + 0.22);
};

const playHat = (context, output, time, noiseBuffer, accent = 0.14) => {
  const noiseSource = context.createBufferSource();
  const highPass = context.createBiquadFilter();
  const gain = context.createGain();

  noiseSource.buffer = noiseBuffer;
  highPass.type = "highpass";
  highPass.frequency.setValueAtTime(7200, time);

  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(accent, time + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);

  noiseSource.connect(highPass).connect(gain).connect(output);
  noiseSource.start(time);
  noiseSource.stop(time + 0.08);
};

const playBass = (context, output, time, frequency) => {
  const oscillator = context.createOscillator();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();

  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(frequency, time);
  oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.98, time + 0.24);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(220, time);
  filter.Q.value = 0.6;

  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.22, time + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.28);

  oscillator.connect(filter).connect(gain).connect(output);
  oscillator.start(time);
  oscillator.stop(time + 0.32);
};

const scheduleIntroBeat = (context, startTime = context.currentTime + 0.05) => {
  const master = context.createGain();
  const compressor = context.createDynamicsCompressor();
  const noiseBuffer = createNoiseBuffer(context);
  const tempo = 92;
  const stepDuration = 60 / tempo / 4;
  const patternLength = 32;
  const patternDurationMs = patternLength * stepDuration * 1000;

  master.gain.value = 0.18;
  compressor.threshold.value = -24;
  compressor.knee.value = 18;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.18;

  master.connect(compressor).connect(context.destination);

  for (let step = 0; step < patternLength; step += 1) {
    const currentTime = startTime + step * stepDuration + (step % 2 === 1 ? 0.012 : 0);
    const barStep = step % 16;

    if (barStep === 0 || barStep === 6 || barStep === 10 || barStep === 14 || step === 24) {
      playKick(context, master, currentTime);
    }

    if (barStep === 4 || barStep === 12 || step === 28) {
      playSnare(context, master, currentTime, noiseBuffer);
    }

    playHat(context, master, currentTime, noiseBuffer, barStep % 4 === 0 ? 0.11 : 0.07);

    if (barStep === 0 || barStep === 8 || barStep === 10 || barStep === 14) {
      const bassNote = barStep === 0 ? 58 : barStep === 8 ? 55 : barStep === 10 ? 53 : 50;
      playBass(context, master, currentTime, bassNote);
    }
  }

  beatState.loopTimer = window.setTimeout(() => {
    try {
      master.disconnect();
      compressor.disconnect();
    } catch (error) {
      void error;
    }
    if (beatState.started) {
      scheduleIntroBeat(context, startTime + patternLength * stepDuration);
    }
  }, Math.max(patternDurationMs - 180, 0));
};

const initIntroBeat = () => {
  if (prefersReducedMotion || beatState.started) {
    return;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    return;
  }

  const playBeat = async () => {
    if (beatState.started) {
      return;
    }

    if (!beatState.context) {
      beatState.context = new AudioContextClass();
    }

    if (beatState.context.state === "suspended") {
      try {
        await beatState.context.resume();
      } catch (error) {
        return;
      }
    }

    scheduleIntroBeat(beatState.context);
    beatState.started = true;

    beatState.fallbackHandlers.forEach(({ type, handler }) => {
      window.removeEventListener(type, handler);
    });
    beatState.fallbackHandlers = [];
  };

  ["pointerdown", "keydown", "touchstart"].forEach((type) => {
    const handler = () => {
      playBeat();
    };

    beatState.fallbackHandlers.push({ type, handler });
    window.addEventListener(type, handler, { once: true, passive: true });
  });

  playBeat();
};

const initCursor = () => {
  if (window.innerWidth <= 768 || prefersReducedMotion) {
    return;
  }

  const cursor = document.querySelector(".cursor");
  const follower = document.querySelector(".cursor-follower");

  gsap.set([cursor, follower], { opacity: 1 });

  window.addEventListener("mousemove", (event) => {
    gsap.to(cursor, {
      x: event.clientX - 7,
      y: event.clientY - 7,
      duration: 0.12,
      overwrite: "auto"
    });

    gsap.to(follower, {
      x: event.clientX - 19,
      y: event.clientY - 19,
      duration: 0.28,
      ease: "power2.out",
      overwrite: "auto"
    });
  });
};

const initHeroAnimation = () => {
  if (!document.querySelector(".hero")) {
    return;
  }

  gsap.set(".hero-subtitle, .hero-description", { y: 18 });
  gsap.set(".hero-actions a, .hero-highlights li", { opacity: 0, y: 18 });
  gsap.set(".hero-badge-top", { x: 24, y: -10 });
  gsap.set(".hero-badge-bottom", { x: -24, y: 10 });
  gsap.set(".hero-grid-lines", { opacity: 0, scale: 1.08 });
  gsap.set(".hero-spark", { opacity: 0, scale: 0.3 });
  gsap.set(".hero-orbit-four", { scale: 0.92, opacity: 0 });
  gsap.set(".hero-graphic-word", { opacity: 0, y: 30 });

  const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });

  timeline
    .to(".site-nav", { y: 0, duration: 0.9 })
    .to(".hero-grid-lines", { opacity: 0.2, scale: 1, duration: 1.4 }, "-=0.4")
    .to(".hero-title", { opacity: 1, y: 0, filter: "blur(0px)", duration: 1 }, "-=0.45")
    .to(".hero-subtitle", { opacity: 1, y: 0, duration: 0.8 }, "-=0.65")
    .to(".hero-description", { opacity: 1, y: 0, duration: 0.75 }, "-=0.5")
    .to(".hero-actions a", { opacity: 1, y: 0, stagger: 0.12, duration: 0.6 }, "-=0.42")
    .to(".hero-highlights li", { opacity: 1, y: 0, stagger: 0.08, duration: 0.45 }, "-=0.35")
    .fromTo(
      ".hero-img",
      { opacity: 0, y: 40, scale: 0.82, rotation: -28 },
      { opacity: 1, y: 0, scale: 1, rotation: 0, duration: 1.45, ease: "back.out(1.25)" },
      "-=0.9"
    )
    .to(".hero-graphic-word", { opacity: 1, y: 0, duration: 0.9 }, "-=0.86")
    .to(".hero-orbit-four", { opacity: 0.7, scale: 1, duration: 1 }, "-=0.95")
    .to(".hero-badge-top", { opacity: 1, x: 0, y: 0, duration: 0.55 }, "-=0.55")
    .to(".hero-badge-bottom", { opacity: 1, x: 0, y: 0, duration: 0.55 }, "-=0.4")
    .to(".hero-spark", { opacity: 0.75, scale: 1, stagger: 0.12, duration: 0.55 }, "-=0.55");

  gsap.to(".hero-img", {
    y: -14,
    duration: 3.8,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut",
    delay: 1.2
  });

  gsap.to(".hero-orbit-one", {
    rotate: 360,
    transformOrigin: "50% 50%",
    duration: 22,
    repeat: -1,
    ease: "none"
  });

  gsap.to(".hero-orbit-two", {
    rotate: -360,
    transformOrigin: "50% 50%",
    duration: 30,
    repeat: -1,
    ease: "none"
  });

  gsap.to(".hero-orbit-three", {
    scale: 1.06,
    duration: 3.8,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut"
  });

  gsap.to(".hero-orbit-four", {
    rotate: 360,
    transformOrigin: "50% 50%",
    duration: 38,
    repeat: -1,
    ease: "none"
  });

  gsap.to(".hero-glow-one", {
    y: -18,
    x: 18,
    duration: 5.5,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut"
  });

  gsap.to(".hero-glow-two", {
    y: 16,
    x: -16,
    duration: 6.5,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut"
  });

  gsap.to(".hero-grid-lines", {
    y: 18,
    x: -12,
    duration: 8,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut"
  });

  gsap.to(".hero-spark-one", {
    x: 30,
    y: -22,
    duration: 4.8,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut"
  });

  gsap.to(".hero-spark-two", {
    x: 22,
    y: 12,
    duration: 3.7,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut"
  });

  gsap.to(".hero-spark-three", {
    x: -24,
    y: 24,
    duration: 4.4,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut"
  });

  gsap.to(".hero-spark-four", {
    x: -28,
    y: -20,
    duration: 5.2,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut"
  });

  gsap.to(".hero-graphic-word", {
    x: 12,
    duration: 6.2,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut"
  });
};

const initHeroParallax = () => {
  if (window.innerWidth <= 768 || prefersReducedMotion) {
    return;
  }

  const hero = document.querySelector(".hero");
  const heroImage = document.querySelector(".hero-img");
  const heroContent = document.querySelector(".hero-content");
  const badges = document.querySelectorAll(".hero-badge");
  const glows = document.querySelectorAll(".hero-glow");
  const sparks = document.querySelectorAll(".hero-spark");
  const word = document.querySelector(".hero-graphic-word");

  if (!hero || !heroImage || !heroContent) {
    return;
  }

  hero.addEventListener("mousemove", (event) => {
    const bounds = hero.getBoundingClientRect();
    const xPercent = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
    const yPercent = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;

    gsap.to(heroImage, {
      rotateY: xPercent * 8,
      rotateX: yPercent * -6,
      x: xPercent * 14,
      y: yPercent * 10 - 8,
      duration: 0.45,
      ease: "power3.out",
      transformPerspective: 900,
      transformOrigin: "center center"
    });

    gsap.to(heroContent, {
      x: xPercent * -10,
      y: yPercent * -6,
      duration: 0.45,
      ease: "power3.out"
    });

    gsap.to(badges, {
      x: (index) => (index === 0 ? xPercent * 16 : xPercent * -14),
      y: (index) => (index === 0 ? yPercent * -10 : yPercent * 10),
      duration: 0.45,
      ease: "power3.out"
    });

    gsap.to(glows, {
      x: (index) => xPercent * (index === 0 ? 24 : -20),
      y: (index) => yPercent * (index === 0 ? 18 : -14),
      duration: 0.6,
      ease: "power3.out"
    });

    gsap.to(sparks, {
      x: (index) => xPercent * (8 + index * 4),
      y: (index) => yPercent * (-6 + index * 3),
      duration: 0.55,
      ease: "power3.out"
    });

    if (word) {
      gsap.to(word, {
        x: xPercent * -18,
        y: yPercent * 8,
        duration: 0.5,
        ease: "power3.out"
      });
    }
  });

  hero.addEventListener("mouseleave", () => {
    gsap.to([heroImage, heroContent, badges, glows, sparks, word], {
      x: 0,
      y: 0,
      rotateX: 0,
      rotateY: 0,
      duration: 0.7,
      ease: "power3.out"
    });
  });

  gsap.to(".hero-visual", {
    yPercent: 10,
    ease: "none",
    scrollTrigger: {
      trigger: hero,
      start: "top top",
      end: "bottom top",
      scrub: 1
    }
  });

  gsap.to(".hero-content", {
    yPercent: -8,
    ease: "none",
    scrollTrigger: {
      trigger: hero,
      start: "top top",
      end: "bottom top",
      scrub: 1
    }
  });
};

const initSectionReveals = () => {
  document.querySelectorAll(".reveal-section").forEach((section) => {
    gsap.to(section, {
      opacity: 1,
      y: 0,
      duration: 0.9,
      ease: "power3.out",
      scrollTrigger: {
        trigger: section,
        start: "top 82%"
      }
    });
  });
};

const initLoader = () => {
  const loader = document.querySelector(".loader");
  const loaderText = document.querySelector(".loader-text");
  const loaderProgress = document.querySelector(".loader-progress");

  if (prefersReducedMotion) {
    loader.style.display = "none";
    gsap.set(".site-nav", { y: 0 });
    gsap.set(".hero-title, .hero-subtitle, .hero-description, .hero-img, .hero-graphic-word, .hero-badge, .reveal-section", {
      opacity: 1,
      y: 0,
      x: 0,
      scale: 1,
      filter: "blur(0px)"
    });
    return;
  }

  gsap.to(loaderText, {
    opacity: 1,
    duration: 0.6,
    ease: "power2.out"
  });

  gsap.to(loaderProgress, {
    width: "100%",
    duration: 1.2,
    ease: "power2.inOut",
    onComplete: () => {
      gsap.to(loader, {
        opacity: 0,
        duration: 0.45,
        onComplete: () => {
          loader.style.display = "none";
          if (document.querySelector(".hero")) {
            initHeroAnimation();
          } else {
            gsap.to(".site-nav", { y: 0, duration: 0.9, ease: "power3.out" });
          }
          initSectionReveals();
        }
      });
    }
  });
};

window.addEventListener("load", () => {
  initThemeToggle();
  initMenu();
  initCtaSelection();
  initCursor();
  initIntroSongChoice();
  initHeroParallax();
  initLoader();

  if (prefersReducedMotion) {
    initSectionReveals();
  }
});
