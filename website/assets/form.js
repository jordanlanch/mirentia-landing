// mirentia — conversion form. 3-step state machine, vanilla, no deps.
// ponytail: tier classification is client-side preview; n8n is authoritative.

(() => {
  const WEBHOOK_URL = 'https://n8n.mirentia.com/webhook/mirentia-lead';
  const MIN_SUBMIT_TIME_MS = 3000;

  const form = document.getElementById('lead-form');
  if (!form) return;

  const steps = Array.from(form.querySelectorAll('.form-step'));
  const stepperDots = Array.from(form.parentElement.querySelectorAll('.form-stepper li'));
  const liveRegion = form.querySelector('.form-live');
  const successPanel = form.parentElement.querySelector('.form-result--success');
  const errorPanel = form.parentElement.querySelector('.form-result--error');
  const tierBadge = form.querySelector('.tier-badge');

  const state = {
    step: 0,
    startedAt: Date.now(),
    data: {
      name: '', work_email: '', company: '',
      role: '', team_size: '', biggest_pain: '',
      budget_range: '', timeline: ''
    }
  };

  // ponytail: tier is shown as info, never blocks submit.
  function classifyTier(budget, timeline) {
    // Cualificado: budget > $5K AND timeline <= 1 month
    const highBudget = budget === '5000' || budget === '18000+';
    const shortTimeline = timeline === 'immediate' || timeline === '1-month';
    if (highBudget && shortTimeline) return 'cualificado';
    // Tibio: budget $1K-$5K OR timeline 1-3 months
    const midBudget = budget === '1000-5000';
    const midTimeline = timeline === '1-3-months';
    if (midBudget || midTimeline) return 'tibio';
    return 'frio';
  }

  const TIER_LABEL = {
    cualificado: 'Cualificado · te contactamos en <24h',
    tibio: 'Tibio · revisamos esta semana',
    frio: 'Frío · te respondemos por email'
  };

  function updateTierBadge() {
    if (!tierBadge) return;
    const tier = classifyTier(state.data.budget_range || '', state.data.timeline || '');
    tierBadge.dataset.tier = tier;
    tierBadge.querySelector('.tier-label').textContent = TIER_LABEL[tier];
    tierBadge.style.display = '';
  }

  function showStep(idx) {
    steps.forEach((s, i) => s.classList.toggle('is-active', i === idx));
    stepperDots.forEach((d, i) => {
      d.classList.toggle('is-active', i === idx);
      d.classList.toggle('is-done', i < idx);
    });
    const firstField = steps[idx].querySelector('input, select, textarea');
    if (firstField) firstField.focus({ preventScroll: false });
  }

  function setFieldError(field, msg) {
    const group = field.closest('.field');
    if (!group) return;
    if (msg) {
      group.classList.add('is-error');
      const errEl = group.querySelector('.field-error');
      if (errEl) errEl.textContent = msg;
    } else {
      group.classList.remove('is-error');
    }
  }

  function clearAllErrors() {
    form.querySelectorAll('.field.is-error').forEach(g => g.classList.remove('is-error'));
  }

  function announce(msg) {
    if (liveRegion) liveRegion.textContent = msg;
  }

  function emailValid(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function validateStep(idx) {
    clearAllErrors();
    let firstInvalid = null;
    const fields = steps[idx].querySelectorAll('[required]');
    fields.forEach(f => {
      const val = (f.value || '').trim();
      if (!val) {
        setFieldError(f, 'Este campo es requerido.');
        if (!firstInvalid) firstInvalid = f;
      } else if (f.type === 'email' && !emailValid(val)) {
        setFieldError(f, 'Email no válido.');
        if (!firstInvalid) firstInvalid = f;
      }
    });
    return firstInvalid;
  }

  function advance(e) {
    e.preventDefault();
    const stepIdx = Number(steps.indexOf(e.target.closest('.form-step')));
    const invalid = validateStep(stepIdx);
    if (invalid) {
      invalid.focus();
      announce('Hay errores en el formulario. Revisá los campos marcados.');
      return;
    }

    // capture data from this step
    const fields = steps[stepIdx].querySelectorAll('input, select, textarea');
    fields.forEach((f) => {
      if (f.name && f.name !== 'b_honey') state.data[f.name] = f.value;
    });

    // after step 1 (idx 0), compute tier preview if budget/timeline already present
    // after step 2 (idx 1), show tier badge
    if (stepIdx === 1) {
      updateTierBadge();
    }

    if (stepIdx < steps.length - 1) {
      state.step = stepIdx + 1;
      showStep(state.step);
    } else {
      submit();
    }
  }

  function back(e) {
    e.preventDefault();
    const stepIdx = Number(steps.indexOf(e.target.closest('.form-step')));
    if (stepIdx > 0) {
      state.step = stepIdx - 1;
      showStep(state.step);
    }
  }

  async function submit() {
    // honeypot check — silently succeed without sending
    const honeypot = form.querySelector('input[name="b_honey"]');
    if (honeypot && honeypot.value) {
      showSuccess();
      return;
    }
    // minimum time check (humans can't fill this fast)
    const elapsed = Date.now() - state.startedAt;
    if (elapsed < MIN_SUBMIT_TIME_MS) {
      // don't send — show error
      showError();
      announce('Lo sentimos, el formulario fue rechazado. Probá de nuevo.');
      return;
    }

    // disable inputs
    setBusy(true);

    // gather UTM params + referrer
    const params = new URLSearchParams(window.location.search);
    const utm = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(k => {
      if (params.get(k)) utm[k] = params.get(k);
    });

    const payload = {
      ...state.data,
      honeypot: honeypot ? honeypot.value : '',
      source: 'landing-mirentia.com',
      timestamp: new Date().toISOString(),
      referrer: document.referrer || '',
      ...utm
    };

    try {
      const res = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      showSuccess();
    } catch (err) {
      showError();
    } finally {
      setBusy(false);
    }
  }

  function setBusy(busy) {
    const btn = form.querySelector('.btn-submit');
    if (!btn) return;
    btn.disabled = busy;
    btn.classList.toggle('is-loading', busy);
    btn.textContent = busy ? 'Enviando' : 'Enviar →';
    form.querySelectorAll('input, select, textarea, button').forEach(el => {
      if (el.classList.contains('btn-back')) return;
      el.disabled = busy;
    });
  }

  function showSuccess() {
    if (successPanel) successPanel.classList.add('is-visible');
    if (errorPanel) errorPanel.classList.remove('is-visible');
    form.style.display = 'none';
    if (stepperDots.length) stepperDots.forEach(d => d.classList.add('is-done'));
    announce('Listo. Tu mensaje fue enviado.');
    successPanel?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function showError() {
    if (errorPanel) errorPanel.classList.add('is-visible');
    if (successPanel) successPanel.classList.remove('is-visible');
    announce('Algo falló. Probá de nuevo o escribinos a hola@mirentia.com.');
  }

  // wire step "next" submits and back buttons
  steps.forEach((step, idx) => {
    const submitBtn = step.querySelector('button[type="submit"], button[data-action="next"]');
    if (submitBtn) submitBtn.addEventListener('click', advance);
    const backBtn = step.querySelector('.btn-back');
    if (backBtn) backBtn.addEventListener('click', back);
    // remove any field errors on input
    step.querySelectorAll('input, select, textarea').forEach(f => {
      f.addEventListener('input', () => setFieldError(f, null));
    });
    // live tier badge update on budget/timeline change (step 3)
    step.querySelectorAll('select').forEach(f => {
      f.addEventListener('change', () => {
        if (f.name) state.data[f.name] = f.value;
        if (f.name === 'budget_range' || f.name === 'timeline') updateTierBadge();
      });
    });
  });

  // initialize
  showStep(0);
})();