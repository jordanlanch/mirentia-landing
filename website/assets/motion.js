// mirentia — native motion. IntersectionObserver-based reveals + counter + VT bootstrap.
// No deps. Degrades to "everything visible" when APIs missing or reduced-motion set.

(() => {
  const prefersReduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- Scroll progress bar ---
  if (!prefersReduce) {
    const bar = document.createElement('div');
    bar.className = 'scroll-progress';
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-label', 'Progreso de scroll');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    document.body.prepend(bar);

    let ticking = false;
    function updateScrollProgress() {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docHeight > 0 ? scrollTop / docHeight : 0;
      bar.style.transform = `scaleX(${pct})`;
      bar.setAttribute('aria-valuenow', Math.round(pct * 100));
      ticking = false;
    }

    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(updateScrollProgress);
        ticking = true;
      }
    }, { passive: true });
  }

  // --- Magnetic CTA ---
  if (!prefersReduce && !matchMedia('(pointer: coarse)').matches) {
    document.querySelectorAll('.cta.primary').forEach((cta) => {
      let targetX = 0, targetY = 0, currentX = 0, currentY = 0;
      let active = false;
      let raf = null;

      cta.addEventListener('pointermove', (e) => {
        const rect = cta.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxPull = 8;
        if (dist < 80) {
          const pull = Math.max(0, (80 - dist) / 80) * maxPull;
          targetX = dist > 0 ? (dx / dist) * pull : 0;
          targetY = dist > 0 ? (dy / dist) * pull : 0;
          active = true;
          cta.classList.add('magnetic');
          if (!raf) raf = requestAnimationFrame(magneticTick);
        } else {
          targetX = 0; targetY = 0;
          active = false;
        }
      });

      cta.addEventListener('pointerleave', () => {
        targetX = 0; targetY = 0;
        active = false;
        cta.classList.remove('magnetic');
      });

      function magneticTick() {
        currentX += (targetX - currentX) * 0.3;
        currentY += (targetY - currentY) * 0.3;
        if (active || Math.abs(currentX) > 0.5 || Math.abs(currentY) > 0.5) {
          cta.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
          raf = requestAnimationFrame(magneticTick);
        } else {
          cta.style.transform = '';
          raf = null;
        }
      }
    });
  }

  // --- Reveal on scroll ---
  const revealEls = document.querySelectorAll('.reveal');
  if (prefersReduce || !('IntersectionObserver' in window) || !revealEls.length) {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
    );
    revealEls.forEach((el) => io.observe(el));
  }

  // --- Counter for .num-counter ---
  const counters = document.querySelectorAll('.num-counter');
  if (counters.length && !prefersReduce && 'IntersectionObserver' in window) {
    const animate = (el) => {
      const target = Number(el.dataset.count || 0);
      const suffix = el.dataset.suffix || '';
      const duration = 1200;
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
        const current = Math.round(target * eased);
        el.textContent = current + suffix;
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    const cio = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animate(entry.target);
            cio.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.4 }
    );
    counters.forEach((el) => cio.observe(el));
  }

  // --- Custom cursor ---
  if (!matchMedia('(pointer: coarse)').matches && !prefersReduce) {
    const dot = document.createElement('div');
    dot.className = 'cursor-dot';
    document.body.appendChild(dot);

    let mx = 0, my = 0, cx = 0, cy = 0;
    let visible = false;

    window.addEventListener('mousemove', (e) => {
      mx = e.clientX;
      my = e.clientY;
      if (!visible) {
        visible = true;
        dot.classList.add('is-visible');
      }
    });

    const tick = () => {
      cx += (mx - cx) * 0.25;
      cy += (my - cy) * 0.25;
      dot.style.transform = `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%)`;
      requestAnimationFrame(tick);
    };
    tick();

    document.querySelectorAll('a, button, .cta, .card').forEach((el) => {
      el.addEventListener('mouseenter', () => dot.classList.add('is-hover'));
      el.addEventListener('mouseleave', () => dot.classList.remove('is-hover'));
    });
  }

  // --- FAQ accordion (single-open) ---
  const faqItems = document.querySelectorAll('.faq-item details');
  if (faqItems.length) {
    // Close all other details when one opens
    faqItems.forEach((details) => {
      details.addEventListener('toggle', () => {
        if (details.hasAttribute('open')) {
          faqItems.forEach((other) => {
            if (other !== details) other.removeAttribute('open');
          });
          // Update URL anchor for deep-linking
          const id = details.closest('.faq-item')?.id;
          if (id) history.replaceState(null, '', '#' + id);
        }
      });
    });

    // Open on anchor load
    if (window.location.hash) {
      const target = document.querySelector(window.location.hash);
      if (target?.tagName === 'DETAILS') target.setAttribute('open', '');
    }
  }

  // --- Newsletter handler ---
  const newsletterForm = document.getElementById('newsletter-form');
  const newsletterSuccess = document.getElementById('newsletter-success');
  const newsletterError = document.getElementById('newsletter-error');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const emailInput = newsletterForm.querySelector('input[type="email"]');
      const email = emailInput?.value.trim();
      const honeypot = newsletterForm.querySelector('input[name="b_honey"]');

      // Honeypot check
      if (honeypot && honeypot.value) return;

      // Email validation
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        newsletterError.classList.add('is-visible');
        newsletterSuccess.classList.remove('is-visible');
        return;
      }

      newsletterError.classList.remove('is-visible');
      newsletterSuccess.classList.add('is-visible');
      newsletterForm.style.display = 'none';
    });
  }

  // --- Split h1.word-stagger into animated word spans ---
  document.querySelectorAll('.word-stagger').forEach((el) => {
    if (prefersReduce) return;
    const accentEl = el.querySelector('.accent');
    const accentText = accentEl ? accentEl.textContent : null;
    const text = el.textContent;
    el.innerHTML = '';
    const words = text.split(/\s+/).filter(Boolean);
    // accentText may span multiple words (e.g. "no dashboards que tenés que aprender.").
    // Mark the LAST N words as accent — gold color comes from .word--accent in motion.css.
    const accentWordCount = accentText ? accentText.split(/\s+/).filter(Boolean).length : 0;
    const accentStartIdx = words.length - accentWordCount;
    words.forEach((word, i) => {
      const span = document.createElement('span');
      span.className = 'word';
      if (i >= accentStartIdx) span.classList.add('word--accent');
      span.style.animationDelay = `${100 + i * 70}ms`;
      // Inline margin-right for word spacing — CSS rule parsing was unreliable.
      if (i < words.length - 1) span.style.marginRight = '0.22em';
      span.textContent = word + ' ';
      el.appendChild(span);
    });
  });
})();
