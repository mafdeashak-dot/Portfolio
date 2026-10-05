// ============================================================
// Theme toggle (dark = space / light = daylight), persisted
// ============================================================
const root = document.documentElement;
const themeToggle = document.getElementById('themeToggle');
const STORAGE_KEY = 'portfolio-theme';
const THEME_COLORS = { dark: '#06070F', light: '#F4F6FD' };
const themeColorMeta = document.querySelector('meta[name="theme-color"]');

function applyTheme(theme) {
  root.setAttribute('data-theme', theme);
  if (themeToggle) {
    const isLight = theme === 'light';
    themeToggle.setAttribute('aria-pressed', String(isLight));
    themeToggle.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
  }
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', THEME_COLORS[theme] || THEME_COLORS.dark);
  }
}

(function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    applyTheme(saved);
  } else {
    // default to dark (space) theme regardless of system preference,
    // since dark is the intended default look of this design
    applyTheme('dark');
  }
})();

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
  });
}

// ============================================================
// Page loader — hides once fonts/layout have settled so there's
// no flash of unstyled content on first paint.
// ============================================================
(function pageLoader() {
  const loader = document.getElementById('pageLoader');
  if (!loader) return;
  const hide = () => loader.classList.add('is-hidden');
  if (document.readyState === 'complete') {
    setTimeout(hide, 150);
  } else {
    window.addEventListener('load', () => setTimeout(hide, 150));
  }
  // safety net so the loader never gets stuck on a slow connection
  setTimeout(hide, 2500);
})();

// ============================================================
// Starfield background (canvas)
// - twinkling stars, slow parallax drift
// - occasional shooting star
// - fewer / dimmer stars in light mode
// - fully paused for prefers-reduced-motion (static stars only)
// ============================================================
(function starfield() {
  const canvas = document.getElementById('starfield');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let width, height, dpr;
  let stars = [];
  let shootingStar = null;
  let lastShot = 0;

  function isLight() {
    return root.getAttribute('data-theme') === 'light';
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildStars();
  }

  function buildStars() {
    const count = Math.round((width * height) / 9000);
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 1.3 + 0.3,
      baseAlpha: Math.random() * 0.6 + 0.3,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.4 + 0.15,
      drift: Math.random() * 0.02 + 0.005
    }));
  }

  function maybeSpawnShootingStar(time) {
    if (shootingStar || time - lastShot < 3500) return;
    if (Math.random() < 0.01) {
      const startX = Math.random() * width * 0.6;
      shootingStar = {
        x: startX,
        y: Math.random() * height * 0.3,
        vx: 6 + Math.random() * 3,
        vy: 3 + Math.random() * 1.5,
        life: 1
      };
      lastShot = time;
    }
  }

  function draw(time) {
    ctx.clearRect(0, 0, width, height);
    const light = isLight();
    const dim = light ? 0.35 : 1;

    for (const s of stars) {
      const twinkle = 0.5 + 0.5 * Math.sin(time * 0.001 * s.speed + s.phase);
      const alpha = s.baseAlpha * twinkle * dim;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = light ? `rgba(91,61,240,${alpha})` : `rgba(255,255,255,${alpha})`;
      ctx.fill();

      if (!prefersReducedMotion) {
        s.y += s.drift;
        if (s.y > height) { s.y = 0; s.x = Math.random() * width; }
      }
    }

    if (!prefersReducedMotion) {
      maybeSpawnShootingStar(time);
      if (shootingStar) {
        const s = shootingStar;
        const grad = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 14, s.y - s.vy * 14);
        grad.addColorStop(0, light ? 'rgba(91,61,240,0.9)' : 'rgba(255,255,255,0.95)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - s.vx * 14, s.y - s.vy * 14);
        ctx.stroke();

        s.x += s.vx;
        s.y += s.vy;
        s.life -= 0.012;
        if (s.life <= 0 || s.x > width || s.y > height) shootingStar = null;
      }
    }

    requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener('resize', resize);
  requestAnimationFrame(draw);
})();

// ============================================================
// Hero name typewriter
// Types out the accent word (e.g. "Ashak") letter by letter on
// first load, then leaves a blinking caret. Skipped entirely
// for prefers-reduced-motion — the full name is shown instantly.
// ============================================================
(function typeName() {
  const el = document.getElementById('typedName');
  if (!el) return;
  const fullText = el.getAttribute('data-type-text') || el.textContent.trim();
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion) {
    el.textContent = fullText;
    return;
  }

  el.textContent = '';
  el.classList.add('is-typing');

  let i = 0;
  const startDelay = 550; // let the reveal animation start first
  const stepMs = 110;

  function typeStep() {
    if (i <= fullText.length) {
      el.textContent = fullText.slice(0, i);
      i += 1;
      setTimeout(typeStep, stepMs);
    } else {
      // stop the caret a couple seconds after finishing
      setTimeout(() => el.classList.remove('is-typing'), 2200);
    }
  }

  setTimeout(typeStep, startDelay);
})();

// ============================================================
// Animated stat counters (hero-meta-num), triggered once
// each number scrolls into view.
// ============================================================
(function animateCounters() {
  const counters = document.querySelectorAll('[data-count-to]');
  if (!counters.length) return;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function runCounter(el) {
    const target = parseInt(el.getAttribute('data-count-to'), 10) || 0;
    const suffix = el.getAttribute('data-suffix') || '';

    if (prefersReducedMotion) {
      el.textContent = target + suffix;
      return;
    }

    const duration = 1200;
    const start = performance.now();

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      el.textContent = Math.round(eased * target) + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  if (!('IntersectionObserver' in window)) {
    counters.forEach(runCounter);
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          runCounter(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.6 }
  );
  counters.forEach((el) => observer.observe(el));
})();

// ============================================================
// Scroll-reveal animations (IntersectionObserver)
// ============================================================
(function scrollReveal() {
  const items = document.querySelectorAll('[data-reveal]');
  if (!items.length) return;

  if (!('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('in-view'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
  );

  items.forEach((el) => observer.observe(el));
})();

// ============================================================
// Mobile navigation toggle
// ============================================================
const navToggle = document.getElementById('navToggle');
const siteHeader = document.querySelector('.site-header');

if (navToggle && siteHeader) {
  navToggle.addEventListener('click', () => {
    const isOpen = siteHeader.classList.toggle('nav-open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });

  document.querySelectorAll('.main-nav a').forEach((link) => {
    link.addEventListener('click', () => {
      siteHeader.classList.remove('nav-open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

// ============================================================
// Footer year
// ============================================================
const yearEl = document.getElementById('year');
if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}

// ============================================================
// Contact form
// ------------------------------------------------------------
// This demo submits nowhere — it only validates and shows a
// status message. To wire it to a real service:
//   1) Formspree / Getform / EmailJS: point the <form> action
//      at the endpoint they give you, or call their JS SDK here.
//   2) Your own API: replace the fetch stub below with a real
//      call to your ASP.NET Core endpoint.
// ============================================================
const contactForm = document.getElementById('contactForm');
const formStatus = document.getElementById('formStatus');

if (contactForm) {
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = contactForm.name.value.trim();
    const email = contactForm.email.value.trim();
    const message = contactForm.message.value.trim();

    if (!name || !email || !message) {
      showStatus('Please fill in every field.', 'error');
      return;
    }
    if (!isValidEmail(email)) {
      showStatus('Please enter a valid email address.', 'error');
      return;
    }

    const submitBtn = contactForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    const originalLabel = submitBtn.textContent;
    submitBtn.textContent = 'Sending…';

    try {
      // Replace with a real request, e.g. Formspree or your own API.
      await new Promise((resolve) => setTimeout(resolve, 700));
      showStatus(`Thanks, ${name.split(' ')[0]} — your message was sent.`, 'success');
      contactForm.reset();
    } catch (err) {
      showStatus('Something went wrong. Please email me directly instead.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  });
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function showStatus(text, type) {
  if (!formStatus) return;
  formStatus.textContent = text;
  formStatus.className = `form-status ${type}`;
}





let scrollUp = document.querySelector(".scroll_up");
window.addEventListener("scroll", function () {
  if(window.scrollY > 200){
    scrollUp.style.display = "block";
  } else {
    scrollUp.style.display = "none";
  }
});

scrollUp.addEventListener("click", function () {
  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
});
