// mirentia — native motion. No frameworks, no deps.
// Adds: typing, custom cursor, WebGL mesh, word stagger, counter drama,
// section reveal variants, enhanced magnetic CTA, ripple, form focus.

(() => {
  const prefersReduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isCoarse = matchMedia("(pointer: coarse)").matches;
  const hasIO = "IntersectionObserver" in window;
  const hasRAF = "requestAnimationFrame" in window;
  const supportsWebGL = (() => {
    if (prefersReduce) return false;
    try {
      const c = document.createElement("canvas");
      return !!(c.getContext("webgl") || c.getContext("experimental-webgl"));
    } catch (e) { return false; }
  })();

  // ---- helpers ----
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const wait = (cond, ms = 2000) => new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      if (cond()) return resolve();
      if (Date.now() - start > ms) return resolve();
      requestAnimationFrame(tick);
    };
    tick();
  });

  // =====================================================================
  // 1. Scroll progress bar (with glow on the leading edge via CSS)
  // =====================================================================
  if (!prefersReduce) {
    const bar = document.createElement("div");
    bar.className = "scroll-progress";
    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-label", "Progreso de scroll");
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", "100");
    document.body.prepend(bar);

    let ticking = false;
    const update = () => {
      const top = window.scrollY;
      const range = document.documentElement.scrollHeight - window.innerHeight;
      const pct = range > 0 ? top / range : 0;
      bar.style.transform = `scaleX(${pct})`;
      bar.setAttribute("aria-valuenow", String(Math.round(pct * 100)));
      ticking = false;
    };
    window.addEventListener("scroll", () => {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    }, { passive: true });
  }

  // =====================================================================
  // 2. Reveal on scroll (existing + modifier classes)
  // =====================================================================
  const revealEls = document.querySelectorAll(".reveal");
  if (revealEls.length) {
    if (prefersReduce || !hasIO) {
      revealEls.forEach((el) => el.classList.add("is-visible"));
    } else {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              io.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
      );
      revealEls.forEach((el) => io.observe(el));
    }
  }

  // =====================================================================
  // 3. Counter (.num-counter) with drama: overshoot scale + gold pulse
  //    The CSS handles the visual; JS only handles counting + label timing.
  // =====================================================================
  const counters = document.querySelectorAll(".num-counter");
  if (counters.length) {
    const animate = (el) => {
      const target = Number(el.dataset.count || 0);
      const suffix = el.dataset.suffix || "";
      const duration = 1100;
      const start = performance.now();
      // easeOutBack for a touch of overshoot on the number itself
      const easeOutBack = (t) => {
        const c1 = 1.70158, c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
      };
      const tick = (now) => {
        const t = Math.min((now - start) / duration, 1);
        const v = Math.round(target * easeOutBack(t));
        el.textContent = Math.max(0, v) + suffix;
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    if (prefersReduce || !hasIO) {
      counters.forEach((el) => {
        el.textContent = (el.dataset.count || el.textContent || "0") + (el.dataset.suffix || "");
        const stat = el.closest(".trust-stat");
        if (stat) stat.classList.add("is-visible");
      });
    } else {
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
  }

  // =====================================================================
  // 4. Word-stagger: split H1/H2 text into per-word spans, reveal after delay
  // =====================================================================
  const wordSources = document.querySelectorAll(".word-stagger-source");
  if (wordSources.length && !prefersReduce) {
    wordSources.forEach((el) => {
      if (el.dataset.split === "done") return;
      const originalHTML = el.innerHTML;
      // Preserve any inline tags (none in current markup, but safe)
      const text = el.textContent;
      el.innerHTML = "";
      el.classList.add("word-stagger");
      // Split on whitespace but keep separators as raw text nodes
      const parts = text.split(/(\s+)/);
      const wordSpans = [];
      parts.forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          el.appendChild(document.createTextNode(part));
        } else {
          const span = document.createElement("span");
          span.className = "word-stagger__word";
          span.textContent = part;
          el.appendChild(span);
          wordSpans.push(span);
        }
      });
      el.dataset.split = "done";

      // Stagger reveal: 80ms per word, starting 500ms after load.
      // For elements below the fold, we still kick it off so it's ready
      // when they scroll in (CSS handles gating via parent .reveal visibility).
      const start = 500 + Math.random() * 120; // tiny jitter for natural feel
      wordSpans.forEach((span, i) => {
        span.style.transitionDelay = `${start + i * 80}ms`;
      });
    });

    // After 50ms, add is-revealing so transitions fire for above-the-fold headings.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        wordSources.forEach((el) => el.classList.add("is-revealing"));
      });
    });
  }

  // =====================================================================
  // 5. Typing: chat messages + code lines
  // =====================================================================
  if (!prefersReduce) {
    // --- chat messages ---
    const msgEls = Array.from(document.querySelectorAll(".chat__body .chat__msg"));
    if (msgEls.length) {
      // Capture original text per msg; preserve the .time span.
      msgEls.forEach((msgEl) => {
        const timeEl = msgEl.querySelector(".time");
        // Build text from non-time children + text nodes
        let text = "";
        msgEl.childNodes.forEach((n) => {
          if (n.nodeType === Node.TEXT_NODE) text += n.textContent;
          else if (n.nodeType === Node.ELEMENT_NODE && !n.classList.contains("time")) {
            text += n.textContent;
          }
        });
        text = text.replace(/\s+/g, " ").trim();
        // Rebuild: text span + (optional) time span
        msgEl.innerHTML = "";
        const textSpan = document.createElement("span");
        textSpan.className = "chat__text";
        msgEl.appendChild(textSpan);
        if (timeEl) msgEl.appendChild(timeEl);
        msgEl._typingText = text;
        msgEl._typingTarget = textSpan;
      });

      const typeMessage = (msgEl, charMs) =>
        new Promise((resolve) => {
          const target = msgEl._typingTarget;
          const text = msgEl._typingText;
          if (!target || !text) return resolve();
          // Add active class (reveals the bubble) + caret
          const caret = document.createElement("span");
          caret.className = "chat__caret";
          target.after(caret);
          msgEl.classList.add("typing-active");
          let i = 0;
          const tick = () => {
            if (i < text.length) {
              target.textContent = text.slice(0, ++i);
              target.after(caret);
              setTimeout(tick, charMs);
            } else {
              caret.remove();
              msgEl.classList.remove("typing-active");
              resolve();
            }
          };
          tick();
        });

      // Sequence: type each msg with charMs, with 250ms gap.
      const charMs = 32;
      const gapMs = 320;
      (async () => {
        await sleep(900); // wait past word-stagger kickoff
        for (const msgEl of msgEls) {
          await typeMessage(msgEl, charMs);
          await sleep(gapMs);
        }
        msgEls.forEach((m) => m.classList.add("typing-done"));
      })();
    }

    // --- code lines ---
    const codeEl = document.querySelector(".code__pre code");
    if (codeEl) {
      // Split the existing tokenized HTML per newline.
      const linesHTML = codeEl.innerHTML.split("\n");
      codeEl.innerHTML = linesHTML
        .map((lineHtml) => `<span class="code__line">${lineHtml || "&nbsp;"}</span>`)
        .join("");
      const lineEls = Array.from(codeEl.querySelectorAll(".code__line"));

      const typeLine = (lineEl, onDone) => {
        lineEl.classList.add("typing-active");
        const caret = document.createElement("span");
        caret.className = "code__caret";
        lineEl.appendChild(caret);
        // Brief per-char flash inside the line (slower than chat for IDE feel)
        const dur = Math.min(380, 80 + lineEl.textContent.length * 14);
        setTimeout(() => {
          caret.remove();
          lineEl.classList.add("typing-done");
          onDone && onDone();
        }, dur);
      };

      (async () => {
        await sleep(1800); // start mid-chat
        for (const line of lineEls) {
          await new Promise((r) => typeLine(line, r));
          await sleep(150);
        }
      })();
    }
  } else {
    // reduced-motion: mark all as done immediately
    document.querySelectorAll(".chat__body .chat__msg").forEach((m) => {
      m.classList.add("typing-done");
    });
    document.querySelectorAll(".code__line").forEach((l) => {
      l.classList.add("typing-active", "typing-done");
    });
  }

  // =====================================================================
  // 6. Magnetic CTA: stronger pull (12px) + proximity shadow + click ripple
  // =====================================================================
  if (!prefersReduce && !isCoarse) {
    document.querySelectorAll(".cta.primary").forEach((cta) => {
      // Make position relative for absolute ripple positioning
      if (getComputedStyle(cta).position === "static") cta.style.position = "relative";
      const maxPull = 12;
      let tx = 0, ty = 0, cx = 0, cy = 0, raf = null;

      const tick = () => {
        cx += (tx - cx) * 0.25;
        cy += (ty - cy) * 0.25;
        cta.style.setProperty("--pull-x", cx.toFixed(2) + "px");
        cta.style.setProperty("--pull-y", cy.toFixed(2) + "px");
        if (Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1) {
          raf = requestAnimationFrame(tick);
        } else {
          raf = null;
        }
      };

      cta.addEventListener("pointermove", (e) => {
        const rect = cta.getBoundingClientRect();
        const mx = rect.left + rect.width / 2;
        const my = rect.top + rect.height / 2;
        const dx = e.clientX - mx;
        const dy = e.clientY - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const zone = 100;
        if (dist < zone && dist > 0) {
          const proximity = (zone - dist) / zone; // 0..1
          cta.style.setProperty("--proximity", proximity.toFixed(3));
          const pull = proximity * maxPull;
          tx = (dx / dist) * pull;
          ty = (dy / dist) * pull;
        } else {
          tx = 0;
          ty = 0;
          cta.style.setProperty("--proximity", "0");
        }
        if (!raf) raf = requestAnimationFrame(tick);
      });

      cta.addEventListener("pointerleave", () => {
        tx = 0;
        ty = 0;
        cta.style.setProperty("--proximity", "0");
        if (!raf) raf = requestAnimationFrame(tick);
      });

      // Click ripple
      cta.addEventListener("pointerdown", (e) => {
        const rect = cta.getBoundingClientRect();
        const r = document.createElement("span");
        r.className = "ripple";
        r.style.left = (e.clientX - rect.left) + "px";
        r.style.top = (e.clientY - rect.top) + "px";
        cta.appendChild(r);
        setTimeout(() => r.remove(), 600);
      });
    });
  }

  // =====================================================================
  // 7. Custom cursor (gold dot + trail canvas). Pointer-only.
  //    Skipped if reduced-motion or coarse pointer.
  // =====================================================================
  if (!prefersReduce && !isCoarse) {
    const dot = document.querySelector(".cursor-dot");
    const trailLayer = document.querySelector(".cursor-trail");
    if (dot && trailLayer && hasRAF) {
      document.body.classList.add("has-cursor");

      // Trail canvas
      const cvs = document.createElement("canvas");
      cvs.style.cssText = "position:absolute;inset:0;width:100%;height:100%;";
      cvs.width = window.innerWidth;
      cvs.height = window.innerHeight;
      trailLayer.appendChild(cvs);
      const ctx = cvs.getContext("2d");

      // Mouse history (10 dots)
      const TRAIL_N = 10;
      const positions = new Array(TRAIL_N).fill(null).map(() => ({ x: -100, y: -100 }));
      let mx = window.innerWidth / 2;
      let my = window.innerHeight / 2;
      let dotX = mx, dotY = my; // lerped position of dot
      let visible = false;

      // Resize
      const onResize = () => {
        cvs.width = window.innerWidth;
        cvs.height = window.innerHeight;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        cvs.width = window.innerWidth * dpr;
        cvs.height = window.innerHeight * dpr;
        cvs.style.width = window.innerWidth + "px";
        cvs.style.height = window.innerHeight + "px";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };
      onResize();
      window.addEventListener("resize", onResize, { passive: true });

      const onMove = (e) => {
        mx = e.clientX;
        my = e.clientY;
        if (!visible) {
          dotX = mx;
          dotY = my;
          dot.classList.add("is-visible");
          visible = true;
        }
        // Hover state
        let isHover = false;
        const tgt = e.target;
        if (tgt && tgt.closest) {
          if (tgt.closest(".cta") || tgt.closest("a")) isHover = true;
        }
        dot.classList.toggle("is-hover", isHover);
      };
      window.addEventListener("pointermove", onMove, { passive: true });

      const draw = () => {
        // Shift history: positions[0] is the most recent past (behind dot)
        for (let i = TRAIL_N - 1; i > 0; i--) {
          positions[i].x = positions[i - 1].x;
          positions[i].y = positions[i - 1].y;
        }
        positions[0].x = dotX;
        positions[0].y = dotY;

        ctx.clearRect(0, 0, cvs.width, cvs.height);

        for (let i = TRAIL_N - 1; i >= 1; i--) {
          const p = positions[i];
          const t = 1 - i / TRAIL_N; // 0..1 fading out
          const alpha = 0.55 * t;
          const radius = 9 * t + 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 215, 0, ${alpha.toFixed(3)})`;
          ctx.fill();
        }

        // Lerp the dot toward the actual cursor
        dotX += (mx - dotX) * 0.18;
        dotY += (my - dotY) * 0.18;
        dot.style.transform = `translate3d(${(dotX - 6).toFixed(1)}px, ${(dotY - 6).toFixed(1)}px, 0)`;

        requestAnimationFrame(draw);
      };
      requestAnimationFrame(draw);
    }
  } else {
    document.body.classList.add("no-cursor");
  }

  // =====================================================================
  // 8. WebGL gradient mesh background (hero). Pauses out of view.
  // =====================================================================
  const mesh = document.getElementById("mesh-bg");
  if (mesh && !prefersReduce && supportsWebGL && hasRAF) {
    const gl = mesh.getContext("webgl", { antialias: false, alpha: false, premultipliedAlpha: false });
    if (gl) {
      // Sizing
      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        mesh.width = window.innerWidth * dpr;
        mesh.height = window.innerHeight * dpr;
        mesh.style.width = window.innerWidth + "px";
        mesh.style.height = window.innerHeight + "px";
        gl.viewport(0, 0, mesh.width, mesh.height);
      };
      resize();
      window.addEventListener("resize", resize, { passive: true });

      // Shaders — sum of 3 radial blobs that drift; low intensity background.
      const vsSrc = `
        attribute vec2 a_pos;
        void main() {
          gl_Position = vec4(a_pos, 0.0, 1.0);
        }
      `;
      const fsSrc = `
        precision mediump float;
        uniform float u_time;
        uniform vec2 u_res;

        // Cheap pseudo-noise based on sin combos
        float n2(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

        void main() {
          vec2 uv = gl_FragCoord.xy / u_res;
          float t = u_time;

          // 3 blob centers, drift via sin/cos
          vec2 p1 = vec2(0.32 + 0.10 * sin(t * 0.13), 0.45 + 0.07 * cos(t * 0.09));
          vec2 p2 = vec2(0.70 + 0.08 * cos(t * 0.11), 0.60 + 0.10 * sin(t * 0.07));
          vec2 p3 = vec2(0.52 + 0.12 * sin(t * 0.17), 0.20 + 0.08 * cos(t * 0.21));

          // Aspect-corrected distances so blobs are circular
          float aspect = u_res.x / max(u_res.y, 1.0);
          vec2 d1 = vec2((uv.x - p1.x) * aspect, uv.y - p1.y);
          vec2 d2 = vec2((uv.x - p2.x) * aspect, uv.y - p2.y);
          vec2 d3 = vec2((uv.x - p3.x) * aspect, uv.y - p3.y);

          float r1 = length(d1);
          float r2 = length(d2);
          float r3 = length(d3);

          vec3 gold   = vec3(1.0, 0.84, 0.0);
          vec3 purple = vec3(0.42, 0.18, 0.65);
          vec3 teal   = vec3(0.0, 0.55, 0.55);
          vec3 ink    = vec3(0.04, 0.04, 0.04);

          // base color = ink (matches --bg)
          vec3 col = ink;

          // Subtle grain so it doesn't band
          float grain = (n2(uv * 800.0 + t) - 0.5) * 0.012;

          col += gold   * smoothstep(0.55, 0.0, r1) * 0.18;
          col += purple * smoothstep(0.65, 0.0, r2) * 0.16;
          col += teal   * smoothstep(0.55, 0.0, r3) * 0.13;
          col += grain;

          // Vignette to focus center
          vec2 m = uv - 0.5;
          col *= 1.0 - dot(m, m) * 0.7;

          gl_FragColor = vec4(col, 1.0);
        }
      `;

      const compile = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
          console.warn("mesh shader:", gl.getShaderInfoLog(s));
          return null;
        }
        return s;
      };
      const vs = compile(gl.VERTEX_SHADER, vsSrc);
      const fs = compile(gl.FRAGMENT_SHADER, fsSrc);
      if (vs && fs) {
        const prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
          console.warn("mesh link:", gl.getProgramInfoLog(prog));
        } else {
          gl.useProgram(prog);

          // Fullscreen triangle pair
          const buf = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, buf);
          gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
            gl.STATIC_DRAW
          );
          const aPos = gl.getAttribLocation(prog, "a_pos");
          gl.enableVertexAttribArray(aPos);
          gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

          const uTime = gl.getUniformLocation(prog, "u_time");
          const uRes = gl.getUniformLocation(prog, "u_res");

          // Fade in once compiled
          requestAnimationFrame(() => mesh.classList.add("is-visible"));

          // Pause when hero leaves viewport
          const heroEl = document.querySelector(".hero");
          let active = true;
          if (heroEl && hasIO) {
            const mio = new IntersectionObserver(
              ([entry]) => {
                active = entry.isIntersecting;
              },
              { rootMargin: "200px" }
            );
            mio.observe(heroEl);
          }

          const start = performance.now();
          const frame = () => {
            if (active) {
              const t = (performance.now() - start) / 1000;
              gl.uniform1f(uTime, t);
              gl.uniform2f(uRes, mesh.width, mesh.height);
              gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            }
            requestAnimationFrame(frame);
          };
          requestAnimationFrame(frame);
        }
      } else {
        // Shader failed — hide mesh so it doesn't show a black box.
        mesh.style.display = "none";
      }
    } else {
      mesh.style.display = "none";
    }
  } else if (mesh) {
    mesh.style.display = "none";
  }

  // =====================================================================
  // 9. FAQ accordion (single-open) — unchanged
  // =====================================================================
  const faqItems = document.querySelectorAll(".faq-item details");
  if (faqItems.length) {
    faqItems.forEach((details) => {
      details.addEventListener("toggle", () => {
        if (details.open) {
          faqItems.forEach((other) => {
            if (other !== details) other.open = false;
          });
        }
      });
    });
    if (window.location.hash) {
      const target = document.querySelector(window.location.hash);
      if (target && target.tagName === "DETAILS") target.open = true;
    }
  }

  // =====================================================================
  // 10. Form submission (POST JSON to n8n webhook) — unchanged behavior
  // =====================================================================
  const form = document.querySelector(".form[data-webhook]");
  if (form) {
    const status = form.querySelector(".form__status");
    const successPanel = form.parentElement?.querySelector(".form__success");
    const submitBtn = form.querySelector(".form__submit");
    const originalLabel = submitBtn ? submitBtn.textContent : "";

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const data = new FormData(form);
      const honeypot = (data.get("b_honey") || "").toString().trim();
      if (honeypot) return;

      const payload = {
        name: (data.get("name") || "").toString().trim(),
        work_email: (data.get("work_email") || "").toString().trim(),
        company: (data.get("company") || "").toString().trim(),
        message: (data.get("message") || "").toString().trim(),
        honeypot,
        source: "landing-mirentia.com",
        timestamp: new Date().toISOString(),
        referrer: document.referrer || ""
      };

      if (!payload.name || !payload.work_email || !payload.company) {
        showStatus("Faltan campos. Revisá nombre, email y empresa.", "error");
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Enviando…";
      }

      try {
        const res = await fetch(form.dataset.webhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!res.ok && res.status !== 0) throw new Error("webhook " + res.status);
        form.reset();
        form.style.display = "none";
        if (successPanel) successPanel.classList.add("is-visible");
      } catch (err) {
        showStatus("No pudimos enviar. Escribinos directo a hola@mirentia.com.", "error");
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalLabel;
        }
      }
    });

    function showStatus(msg, kind) {
      if (!status) return;
      status.textContent = msg;
      status.className = `form__status is-visible form__status--${kind}`;
    }
  }

  // =====================================================================
  // 11. Agent journey — scroll-scrubbed 5 scenes (sticky shell, SVG visuals)
  //     Reduced-motion: render scene 0 statically, hide rail/topbar/footer.
  // =====================================================================
  const journey = document.querySelector(".agent-journey");
  if (journey) {
    const stages = Array.from(journey.querySelectorAll(".agent-journey__stage"));
    const copyBlocks = Array.from(journey.querySelectorAll(".agent-journey__copy-block"));
    const dots = Array.from(journey.querySelectorAll(".agent-journey__dot"));
    const chapter = journey.querySelector(".agent-journey__chapter");
    const counter = journey.querySelector(".agent-journey__counter span");
    const stageCount = stages.length;

    if (stageCount > 0) {
      // Cache per-scene element handles (one-time)
      const s1Bubble = stages[0].querySelector(".s1-bubble");
      const s1Ts = stages[0].querySelector(".s1-timestamp");
      const s2Lines = Array.from(stages[1].querySelectorAll(".s2-line"));
      const s3Paths = Array.from(stages[2].querySelectorAll(".s3-path"));
      const s3Meta = stages[2].querySelector(".s3-meta");
      const s4Target = stages[3].querySelector(".s4-target");
      const s4Label = stages[3].querySelector(".s4-label");
      const s4Check = stages[3].querySelector(".s4-check");
      const s5Counter = stages[4].querySelector(".s5-counter");
      const s5Line = stages[4].querySelector(".s5-chart-line");
      const s5Dot = stages[4].querySelector(".s5-chart-dot");

      // Pre-compute chart dash length so we can animate stroke-dashoffset.
      let s5Dash = 0;
      if (s5Line) {
        s5Dash = s5Line.getTotalLength();
        s5Line.style.strokeDasharray = String(s5Dash);
        s5Line.style.strokeDashoffset = String(s5Dash);
      }

      const chapterLabels = [
        "01 · LLEGA",
        "02 · ENTIENDE",
        "03 · DECIDE",
        "04 · EJECUTA",
        "05 · APRENDE",
      ];

      const clamp01 = (v) => Math.max(0, Math.min(1, v));
      const lerp = (a, b, t) => a + (b - a) * t;

      const renderScene = (idx, local) => {
        if (idx === 0) {
          if (s1Bubble) {
            if (local < 0.3) {
              const t = local / 0.3;
              s1Bubble.style.opacity = String(t);
              s1Bubble.style.transform = `scale(${lerp(0.4, 1, t)}) translateY(${(1 - t) * 24}px)`;
            } else {
              s1Bubble.style.opacity = "1";
              s1Bubble.style.transform = "scale(1) translateY(0)";
            }
          }
          if (s1Ts) {
            s1Ts.style.opacity = String(clamp01((local - 0.5) / 0.3));
          }
        } else if (idx === 1) {
          s2Lines.forEach((line, i) => {
            const start = (i / s2Lines.length) * 0.6;
            const t = clamp01((local - start) / 0.15);
            line.style.opacity = String(0.15 + 0.85 * t);
          });
          const agendarRect = s2Lines[0] && s2Lines[0].querySelector("rect");
          const agendarText = s2Lines[0] && s2Lines[0].querySelector("text");
          const goldT = clamp01((local - 0.7) / 0.2);
          if (agendarRect) {
            agendarRect.style.stroke = `rgba(255, 215, 0, ${goldT})`;
            agendarRect.style.fill = `rgba(255, 215, 0, ${goldT * 0.08})`;
          }
          if (agendarText) {
            agendarText.setAttribute("fill", goldT > 0.5 ? "#FFD700" : "#f3efe5");
          }
        } else if (idx === 2) {
          s3Paths.forEach((p) => {
            const isAgendar = p.dataset.path === "agendar";
            const onT = isAgendar ? clamp01((local - 0.2) / 0.4) : 0;
            const dimT = isAgendar ? 1 : clamp01(1 - local * 0.55);
            const line = p.querySelector("line");
            const rect = p.querySelector("rect");
            const texts = p.querySelectorAll("text");
            if (line) {
              line.style.stroke = isAgendar
                ? `rgba(255, 215, 0, ${0.5 + 0.5 * onT})`
                : `rgba(120, 120, 120, ${0.4 + dimT * 0.5})`;
              line.style.strokeWidth = isAgendar ? String(2.5 + onT) : "2";
            }
            if (rect) {
              rect.style.stroke = isAgendar
                ? `rgba(255, 215, 0, ${onT})`
                : `rgba(80, 80, 80, ${0.3 + dimT * 0.5})`;
            }
            texts.forEach((t) => {
              t.style.fill = isAgendar
                ? `rgba(255, 215, 0, ${0.7 + 0.3 * onT})`
                : `rgba(160, 160, 160, ${0.4 + dimT * 0.5})`;
            });
          });
          if (s3Meta) {
            s3Meta.style.opacity = String(clamp01((local - 0.5) / 0.3));
          }
        } else if (idx === 3) {
          const fillT = clamp01(local / 0.6);
          if (s4Target) {
            s4Target.style.fill = `rgba(255, 215, 0, ${fillT * 0.22})`;
            s4Target.style.transform = `scale(${1 + fillT * 0.08})`;
          }
          if (s4Label) {
            s4Label.style.opacity = String(clamp01((local - 0.3) / 0.2));
          }
          if (s4Check) {
            s4Check.style.opacity = String(clamp01((local - 0.7) / 0.2));
          }
        } else if (idx === 4) {
          if (s5Counter) {
            s5Counter.textContent = String(Math.round(clamp01(local) * 47));
          }
          if (s5Line && s5Dash > 0) {
            s5Line.style.strokeDashoffset = String(s5Dash * (1 - clamp01(local)));
          }
          if (s5Dot) {
            s5Dot.style.opacity = String(clamp01((local - 0.85) / 0.15));
          }
        }
      };

      const update = () => {
        const rect = journey.getBoundingClientRect();
        const total = journey.offsetHeight - window.innerHeight;
        const progress = total > 0 ? clamp01(-rect.top / total) : 0;
        const exact = progress * stageCount;
        const idx = Math.min(stageCount - 1, Math.floor(exact));
        const local =
          idx === stageCount - 1
            ? clamp01(exact - idx)
            : exact - idx;

        const fade = (local - 0.85) / 0.15;

        stages.forEach((stage, i) => {
          let opacity = 0;
          if (i === idx) opacity = 1 - Math.max(0, fade);
          else if (i === idx + 1) opacity = Math.max(0, fade);
          stage.style.opacity = String(opacity);
        });

        copyBlocks.forEach((block, i) => {
          block.classList.toggle("is-active", i === idx);
          block.setAttribute("aria-hidden", i !== idx);
        });

        dots.forEach((dot, i) => {
          dot.classList.toggle("is-active", i === idx);
        });

        if (chapter) chapter.textContent = chapterLabels[idx];
        if (counter) counter.textContent = String(idx + 1).padStart(2, "0");

        renderScene(idx, local);
        // Pre-render the next scene at local=0 so it doesn't pop in mid-state
        if (idx + 1 < stageCount) renderScene(idx + 1, 0);

        journey.style.setProperty("--journey-progress", progress.toFixed(4));
      };

      if (prefersReduce) {
        stages.forEach((s, i) => {
          s.style.opacity = i === 0 ? "1" : "0";
        });
        copyBlocks.forEach((b, i) => {
          b.classList.toggle("is-active", i === 0);
          b.setAttribute("aria-hidden", i !== 0);
        });
        dots.forEach((d, i) => d.classList.toggle("is-active", i === 0));
        if (chapter) chapter.textContent = chapterLabels[0];
        if (counter) counter.textContent = "01";
        renderScene(0, 1);
      } else {
        let ticking = false;
        const onScroll = () => {
          if (!ticking) {
            requestAnimationFrame(() => {
              update();
              ticking = false;
            });
            ticking = true;
          }
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);

        dots.forEach((dot, i) => {
          dot.addEventListener("click", () => {
            const total = journey.offsetHeight - window.innerHeight;
            const targetTop =
              journey.offsetTop + (i / (stageCount - 1)) * total;
            window.scrollTo({
              top: targetTop,
              behavior: prefersReduce ? "auto" : "smooth",
            });
          });
        });

        update();
      }
    }
  }
})();
