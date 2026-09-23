/* =========================================================
   Happy Birthday: interactions
   Nothing personal lives here. The name, photos, song and
   letter are all edited in index.html.
   ========================================================= */
(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const random = (min, max) => min + Math.random() * (max - min);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Always start at the gift, even after a refresh.
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  /* ---------------------------------------------------------
     Confetti: hearts, dots and paper strips on a canvas
     --------------------------------------------------------- */
  const confetti = (() => {
    const canvas = $("#confetti");
    const ctx = canvas ? canvas.getContext("2d") : null;
    const COLORS = ["#ff5fa8", "#ff8cc6", "#ffc2df", "#b98cff", "#8f5cf5", "#ffc862"];
    let pieces = [];
    let frame = 0;
    let last = 0;
    let width = 0;
    let height = 0;

    function resize() {
      if (!ctx) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function drawHeart(size) {
      const s = size / 2;
      ctx.beginPath();
      ctx.moveTo(0, s * 0.6);
      ctx.bezierCurveTo(-s * 1.2, -s * 0.2, -s * 0.5, -s * 1.1, 0, -s * 0.4);
      ctx.bezierCurveTo(s * 0.5, -s * 1.1, s * 1.2, -s * 0.2, 0, s * 0.6);
      ctx.fill();
    }

    function draw(p) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, (p.ttl - p.age) / 30));
      ctx.translate(p.x, p.y);
      ctx.fillStyle = p.color;
      if (p.shape === "heart") {
        ctx.rotate(Math.sin(p.rotation) * 0.4); // hearts stay (mostly) upright
        drawHeart(p.size * 1.5);
      } else if (p.shape === "dot") {
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.35, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.rotate(p.rotation);
        ctx.scale(1, Math.cos(p.age * 0.12 + p.wobble)); // paper flipping in the air
        ctx.fillRect(-p.size / 2, -p.size * 0.3, p.size, p.size * 0.6);
      }
      ctx.restore();
    }

    function tick(now) {
      const dt = Math.min(Math.max((now - last) / 16.7, 0), 3); // same speed on 60 Hz and 120 Hz screens
      const drag = Math.pow(0.97, dt);
      last = now;
      ctx.clearRect(0, 0, width, height);
      pieces = pieces.filter((p) => p.age < p.ttl && p.y < height + 40);
      for (const p of pieces) {
        p.age += dt;
        p.vx *= drag;
        p.vy = p.vy * drag + 0.15 * dt;
        p.x += (p.vx + Math.sin(p.age * 0.07 + p.wobble) * 0.6) * dt;
        p.y += p.vy * dt;
        p.rotation += p.spin * dt;
        draw(p);
      }
      frame = pieces.length ? requestAnimationFrame(tick) : 0;
    }

    function burst(options = {}) {
      if (!ctx) return;
      const {
        x = width / 2,
        y = height / 2,
        count = 120,
        angle = -Math.PI / 2,
        spread = Math.PI * 2,
        power = 12,
        shapes = ["strip", "dot", "heart"],
      } = options;
      const total = reduceMotion ? Math.ceil(count / 4) : count;
      for (let i = 0; i < total; i++) {
        const direction = angle + (Math.random() - 0.5) * spread;
        const speed = power * random(0.45, 1.2);
        pieces.push({
          x,
          y,
          vx: Math.cos(direction) * speed,
          vy: Math.sin(direction) * speed,
          size: random(7, 13),
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          shape: shapes[Math.floor(Math.random() * shapes.length)],
          rotation: random(0, Math.PI * 2),
          spin: random(-0.1, 0.1),
          wobble: random(0, Math.PI * 2),
          age: 0,
          ttl: random(160, 260),
        });
      }
      if (!frame) {
        last = performance.now();
        frame = requestAnimationFrame(tick);
      }
    }

    function celebrate() {
      burst({ y: height * 0.42, count: 150, power: 12 });
      setTimeout(() => {
        burst({ x: 0, y: height, count: 70, angle: -Math.PI * 0.39, spread: 0.6, power: 26 });
        burst({ x: width, y: height, count: 70, angle: -Math.PI * 0.61, spread: 0.6, power: 26 });
      }, 250);
    }

    resize();
    window.addEventListener("resize", resize);
    return { burst, celebrate };
  })();

  /* ---------------------------------------------------------
     The YouTube song
     Phones only allow sound after the visitor taps something,
     so the song is started from the tap on the gift.
     --------------------------------------------------------- */
  const music = (() => {
    const holder = $("#ytPlayer");
    const section = $("#song");
    const button = $("#musicBtn");
    const noMusic = { play() {}, showButton() {} };
    if (!holder || !button) return noMusic;

    const link = holder.dataset.video || "";
    const videoId = getVideoId(link);
    if (!videoId) {
      console.warn("Birthday page: couldn't find a YouTube video in data-video:", link);
      return noMusic;
    }
    const start = getStartTime(link);
    const loop = holder.dataset.loop !== "false";

    let player = null;
    let ready = false;
    let playing = false;
    let wantsToPlay = false;
    let broken = false;
    let resumeOnReturn = false;
    let checkTimer = 0;

    // Build the iframe ourselves so it is allowed to autoplay with sound.
    const params = new URLSearchParams({ enablejsapi: "1", playsinline: "1", rel: "0", iv_load_policy: "3" });
    if (start) params.set("start", String(start));
    if (location.protocol.startsWith("http")) params.set("origin", location.origin);
    const iframe = document.createElement("iframe");
    iframe.src = `https://www.youtube.com/embed/${videoId}?${params}`;
    iframe.title = "Birthday song";
    iframe.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen; web-share";
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    holder.appendChild(iframe);

    window.onYouTubeIframeAPIReady = () => {
      player = new YT.Player(iframe, {
        events: {
          onReady() {
            ready = true;
            if (wantsToPlay) play();
          },
          onStateChange({ data }) {
            if (data === YT.PlayerState.ENDED && loop) {
              player.seekTo(start, true);
              player.playVideo();
              return;
            }
            setPlaying(data === YT.PlayerState.PLAYING || data === YT.PlayerState.BUFFERING);
          },
          onAutoplayBlocked: needsTap,
          onError({ data }) {
            broken = true;
            button.hidden = true;
            console.warn(
              `Birthday page: YouTube error ${data}.` +
                (data === 101 || data === 150 ? " The owner of this video doesn't allow embedding, so pick another one." : "")
            );
          },
        },
      });
    };
    const api = document.createElement("script");
    api.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(api);

    function setPlaying(isPlaying) {
      playing = isPlaying;
      button.classList.toggle("is-playing", isPlaying);
      button.setAttribute("aria-label", isPlaying ? "Pause music" : "Play music");
      if (isPlaying) {
        clearTimeout(checkTimer);
        button.classList.remove("needs-tap");
        if (section) section.classList.remove("needs-tap");
      }
    }

    // The browser refused to start the sound by itself, so ask for one more tap.
    function needsTap() {
      if (playing || broken) return;
      button.classList.add("needs-tap");
      if (section) section.classList.add("needs-tap");
    }

    function play() {
      wantsToPlay = true;
      clearTimeout(checkTimer);
      checkTimer = setTimeout(() => {
        if (!playing) needsTap();
      }, 3500);
      if (!ready) return; // onReady will call play() again
      player.unMute();
      player.setVolume(100);
      player.playVideo();
    }

    button.addEventListener("click", () => {
      if (playing) {
        wantsToPlay = false;
        player.pauseVideo();
        return;
      }
      const wasStuck = button.classList.contains("needs-tap");
      play();
      // Still silent? Bring the video on screen so she can press play on it directly.
      if (wasStuck) {
        setTimeout(() => {
          if (!playing) holder.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 1200);
      }
    });

    // Pause while she's in another app or tab, carry on when she comes back.
    document.addEventListener("visibilitychange", () => {
      if (!ready) return;
      if (document.hidden && playing) {
        resumeOnReturn = true;
        player.pauseVideo();
      } else if (!document.hidden && resumeOnReturn) {
        resumeOnReturn = false;
        player.playVideo();
      }
    });

    return {
      play,
      showButton() {
        if (!broken) button.hidden = false;
      },
    };
  })();

  // Accepts watch?v=, youtu.be/, shorts/, embed/ and live/ links, or a bare 11-character ID.
  function getVideoId(link) {
    const value = link.trim();
    if (/^[\w-]{11}$/.test(value)) return value;
    try {
      const url = new URL(value);
      if (url.hostname.endsWith("youtu.be")) return url.pathname.split("/")[1] || null;
      if (url.searchParams.get("v")) return url.searchParams.get("v");
      const match = url.pathname.match(/\/(?:embed|shorts|live|v)\/([\w-]{11})/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  // Reads ?t=90, ?t=1m30s or ?start=90 from the link, in seconds.
  function getStartTime(link) {
    try {
      const url = new URL(link);
      const t = url.searchParams.get("t") || url.searchParams.get("start") || "";
      if (/^\d+$/.test(t)) return Number(t);
      const match = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
      return match ? Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0) : 0;
    } catch {
      return 0;
    }
  }

  /* ---------------------------------------------------------
     Background hearts & sparkles
     --------------------------------------------------------- */
  const HEART_SVG =
    '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
  const SPARKLE_SVG =
    '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 0c.6 6.2 5.8 11.4 12 12-6.2.6-11.4 5.8-12 12-.6-6.2-5.8-11.4-12-12C6.2 11.4 11.4 6.2 12 0z"/></svg>';
  const FLOATY_COLORS = ["#ff7eb9", "#ffb3d9", "#c9a8ff", "#9b6bff", "#ff5fa8"];

  function createFloaties() {
    const layer = $("#floaties");
    if (!layer || reduceMotion) return;
    const count = window.innerWidth < 720 ? 16 : 26;
    for (let i = 0; i < count; i++) {
      const isSparkle = i % 4 === 0;
      const el = document.createElement("span");
      el.className = "floaty";
      el.innerHTML = isSparkle ? SPARKLE_SVG : HEART_SVG;
      el.style.setProperty("--x", `${random(0, 96)}%`);
      el.style.setProperty("--size", `${isSparkle ? random(10, 18) : random(14, 30)}px`);
      el.style.setProperty("--color", isSparkle ? "#ffc862" : FLOATY_COLORS[i % FLOATY_COLORS.length]);
      el.style.setProperty("--alpha", random(0.35, 0.75).toFixed(2));
      el.style.setProperty("--duration", `${random(12, 22)}s`);
      el.style.setProperty("--delay", `${-random(0, 22)}s`);
      el.style.setProperty("--spin", `${random(-60, 60)}deg`);
      layer.appendChild(el);
    }
  }

  /* ---------------------------------------------------------
     "HAPPY BIRTHDAY" → one <span> per letter so they can bounce
     --------------------------------------------------------- */
  function splitIntoLetters(el) {
    const text = el.textContent.trim();
    const readable = document.createElement("span");
    const visual = document.createElement("span");
    readable.className = "sr-only";
    readable.textContent = text;
    visual.setAttribute("aria-hidden", "true");

    let index = 0;
    text.split(/\s+/).forEach((word, w) => {
      if (w > 0) visual.append(" ");
      const wordEl = document.createElement("span");
      wordEl.className = "word";
      for (const letter of word) {
        const letterEl = document.createElement("span");
        letterEl.className = "ch";
        letterEl.style.setProperty("--i", index++);
        letterEl.textContent = letter;
        wordEl.append(letterEl);
      }
      visual.append(wordEl);
    });

    el.textContent = "";
    el.append(readable, visual);
  }

  // Shrinks the name only if it's too long to fit on the screen.
  function fitName() {
    const name = $(".hero__name");
    if (!name) return;
    name.style.fontSize = "";
    let size = parseFloat(getComputedStyle(name).fontSize);
    while (name.scrollWidth > name.clientWidth + 1 && size > 28) {
      size -= 2;
      name.style.fontSize = `${size}px`;
    }
  }

  /* ---------------------------------------------------------
     Intro gift
     --------------------------------------------------------- */
  function setupIntro() {
    const intro = $("#intro");
    if (!intro) {
      revealPage();
      return;
    }
    document.body.classList.add("is-locked");
    let opened = false;

    intro.addEventListener("click", () => {
      if (opened) return;
      opened = true;
      music.play(); // has to run right inside the tap, or phones keep the sound blocked
      intro.classList.add("is-opening");

      setTimeout(() => {
        intro.classList.add("is-open");
        document.body.classList.remove("is-locked");
        window.scrollTo(0, 0);
        revealPage();
        confetti.celebrate();
      }, reduceMotion ? 0 : 700);

      setTimeout(() => intro.remove(), reduceMotion ? 800 : 1600);
    });
  }

  function revealPage() {
    document.body.classList.add("is-revealed");
    music.showButton();
  }

  /* ---------------------------------------------------------
     Fade sections in as she scrolls
     --------------------------------------------------------- */
  function setupReveal() {
    const items = $$(".reveal");
    if (!("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
    items.forEach((el) => observer.observe(el));
  }

  /* ---------------------------------------------------------
     Photo viewer (tap, swipe, arrow keys)
     --------------------------------------------------------- */
  function setupLightbox() {
    const box = $("#lightbox");
    const photos = $$(".polaroid");
    if (!box || !photos.length) return;
    const image = $("#lightboxImg");
    const caption = $("#lightboxCaption");
    const closeButton = $(".lightbox__close", box);
    let index = 0;
    let lastFocus = null;

    function show(i) {
      index = (i + photos.length) % photos.length;
      const photo = photos[index].querySelector("img");
      const text = photos[index].querySelector(".polaroid__caption");
      image.src = photo.currentSrc || photo.src;
      image.alt = photo.alt;
      caption.textContent = text ? text.textContent : "";
    }

    function open(i) {
      lastFocus = document.activeElement;
      show(i);
      box.classList.add("is-open");
      document.body.classList.add("is-locked");
      closeButton.focus({ preventScroll: true });
    }

    function close() {
      box.classList.remove("is-open");
      document.body.classList.remove("is-locked");
      if (lastFocus) lastFocus.focus({ preventScroll: true });
    }

    photos.forEach((photo, i) => photo.addEventListener("click", () => open(i)));
    closeButton.addEventListener("click", close);
    $(".lightbox__prev", box).addEventListener("click", () => show(index - 1));
    $(".lightbox__next", box).addEventListener("click", () => show(index + 1));
    box.addEventListener("click", (event) => {
      if (event.target === box || event.target.classList.contains("lightbox__figure")) close();
    });

    document.addEventListener("keydown", (event) => {
      if (!box.classList.contains("is-open")) return;
      if (event.key === "Escape") close();
      if (event.key === "ArrowLeft") show(index - 1);
      if (event.key === "ArrowRight") show(index + 1);
    });

    let startX = 0;
    let startY = 0;
    box.addEventListener(
      "touchstart",
      (event) => {
        startX = event.touches[0].clientX;
        startY = event.touches[0].clientY;
      },
      { passive: true }
    );
    box.addEventListener("touchend", (event) => {
      const dx = event.changedTouches[0].clientX - startX;
      const dy = event.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) show(index + (dx < 0 ? 1 : -1));
    });
  }

  /* ---------------------------------------------------------
     Birthday cake: blow out the candles
     --------------------------------------------------------- */
  function setupCake() {
    const cake = $("#cake");
    const candles = $$(".candle");
    const button = $("#blowBtn");
    const message = $("#wishMsg");
    if (!cake || !candles.length || !button || !message) return;

    const blowLabel = button.textContent;
    const wishText = message.textContent;
    message.textContent = ""; // filled in when the wish comes true, so screen readers announce it

    const isOut = (candle) => candle.classList.contains("is-out");

    function blowOut(candle) {
      if (isOut(candle)) return;
      candle.classList.add("is-out");
      candle.setAttribute("aria-label", "Candle blown out");
      if (candles.every(isOut)) wishCameTrue();
    }

    function wishCameTrue() {
      cake.classList.add("is-dark");
      message.textContent = wishText;
      message.classList.add("is-shown");
      button.textContent = "Light them again 🕯️";
      const rect = cake.getBoundingClientRect();
      confetti.burst({ x: rect.left + rect.width / 2, y: rect.top + 30, count: 150, power: 12 });
    }

    function relight() {
      candles.forEach((candle) => {
        candle.classList.remove("is-out");
        candle.setAttribute("aria-label", "Blow out candle");
      });
      cake.classList.remove("is-dark");
      message.classList.remove("is-shown");
      button.textContent = blowLabel;
    }

    candles.forEach((candle) => candle.addEventListener("click", () => blowOut(candle)));
    button.addEventListener("click", () => {
      const lit = candles.filter((candle) => !isOut(candle));
      if (!lit.length) {
        relight();
        return;
      }
      lit.forEach((candle, i) => setTimeout(() => blowOut(candle), i * 200));
    });
  }

  /* ---------------------------------------------------------
     Little easter egg: tap the top of the page for hearts
     --------------------------------------------------------- */
  function setupHeroHearts() {
    const hero = $(".hero");
    if (!hero) return;
    hero.addEventListener("click", (event) => {
      if (event.target.closest("a, button")) return;
      confetti.burst({ x: event.clientX, y: event.clientY, count: 14, power: 7, shapes: ["heart"] });
    });
  }

  /* ---------------------------------------------------------
     Start everything
     --------------------------------------------------------- */
  createFloaties();
  $$("[data-split]").forEach(splitIntoLetters);
  fitName();
  if (document.fonts) document.fonts.ready.then(fitName);
  let fitFrame = 0;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(fitFrame);
    fitFrame = requestAnimationFrame(fitName);
  });

  setupIntro();
  setupReveal();
  setupLightbox();
  setupCake();
  setupHeroHearts();
})();
