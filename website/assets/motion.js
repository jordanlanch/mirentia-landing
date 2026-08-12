// mirentia — native motion. IntersectionObserver-based reveals + counter + VT bootstrap.
// No deps. Degrades to "everything visible" when APIs missing or reduced-motion set.

(() => {
  const prefersReduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

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
