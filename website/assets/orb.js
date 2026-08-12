// mirentia — AI Orb Agent. Three.js hero scene. No deps beyond three@0.169.0.
// Pure ES module from CDN. Lazy on resources, eager on visual impact.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const GOLD = new THREE.Color('#FFD700');

// -------- Early exits: WebGL absent, mobile, reduced motion. --------
function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

function renderFallback(reason) {
  const canvas = document.getElementById('orb-canvas');
  if (!canvas) return;
  const wrap = document.createElement('div');
  wrap.className = 'orb-fallback';
  wrap.setAttribute('aria-hidden', 'true');
  // Static gold orb — same silhouette, zero JS cost.
  wrap.innerHTML = `
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="g" cx="38%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#fff4a8"/>
          <stop offset="55%" stop-color="#FFD700"/>
          <stop offset="100%" stop-color="#7a5a00"/>
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="80" fill="url(#g)"/>
      <ellipse cx="78" cy="76" rx="26" ry="14" fill="#fff" opacity="0.35"/>
      <ellipse cx="100" cy="100" rx="96" ry="14" fill="none" stroke="#FFD700" stroke-width="1" opacity="0.6"/>
      <ellipse cx="100" cy="100" rx="14" ry="96" fill="none" stroke="#FFD700" stroke-width="1" opacity="0.6"/>
    </svg>`;
  canvas.replaceWith(wrap);
  console.info('[orb] fallback rendered:', reason);
}

if (!hasWebGL()) {
  renderFallback('no-webgl');
} else if (matchMedia('(max-width: 767px)').matches || matchMedia('(pointer: coarse)').matches) {
  // Mobile path: keep the canvas element invisible via CSS, no scene init.
  const c = document.getElementById('orb-canvas');
  if (c) c.style.display = 'none';
} else {
  bootScene();
}

// -------- The scene itself --------
function bootScene() {
  const prefersReduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const canvas = document.getElementById('orb-canvas');
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true,
    preserveDrawingBuffer: false, powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  // Camera offset to the LEFT so the orb sits in the right portion of the viewport,
  // leaving the left side clear for the hero copy.
  camera.position.set(-1.6, 0, 5.2);
  camera.lookAt(0, 0, 0);

  // Real IBL — RoomEnvironment baked through PMREM. No HDR file, no auth.
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envMap;

  // -------- Orb (the signature) --------
  const orbGeo = new THREE.IcosahedronGeometry(0.9, 5);
  const orbMat = new THREE.MeshPhysicalMaterial({
    color: GOLD, metalness: 1, roughness: 0.2,
    clearcoat: 1, clearcoatRoughness: 0.15, envMapIntensity: 0.9,
  });

  // Custom GLSL: flowing gold "thinking" pattern injected into the PBR shader.
  const orbUniforms = { uTime: { value: 0 } };
  orbMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = orbUniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWorldPos;`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\nvWorldPos = worldPosition.xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uTime;\nvarying vec3 vWorldPos;\n
        float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
        float vnoise(vec3 p){vec3 i=floor(p),f=fract(p);
          float n=mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                      mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
          return n;}`)
      .replace('#include <emissivemap_fragment>', `
        vec3 q = vWorldPos * 2.2 + vec3(0.0, uTime * 0.18, 0.0);
        float n = vnoise(q) * 0.6 + vnoise(q * 2.3 + uTime * 0.3) * 0.3 + vnoise(q * 5.0) * 0.1;
        float bands = smoothstep(0.55, 0.95, n);
        totalEmissiveRadiance += vec3(1.0, 0.84, 0.25) * bands * 0.55;
      `);
  };
  const orb = new THREE.Mesh(orbGeo, orbMat);
  scene.add(orb);

  // -------- Orbital rings --------
  const ringGeo = new THREE.TorusGeometry(1, 0.02, 8, 100);
  const ringMat = new THREE.MeshBasicMaterial({ color: GOLD, wireframe: false, transparent: true, opacity: 0.55 });
  const rings = [
    new THREE.Mesh(ringGeo, ringMat),
    new THREE.Mesh(ringGeo, ringMat.clone()),
    new THREE.Mesh(ringGeo, ringMat.clone()),
  ];
  rings[0].rotation.x = Math.PI / 2;
  rings[1].rotation.y = Math.PI / 2;
  rings[2].rotation.z = Math.PI / 2;
  rings.forEach(r => scene.add(r));

  // -------- GPU particles spiraling toward orb --------
  const PARTICLE_BASE = 200;
  const particleCount = prefersReduce ? 0 : PARTICLE_BASE;
  let particles, pGeo, particleMat;
  if (particleCount) {
    const positions = new Float32Array(particleCount * 3);
    const seeds = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i++) {
      const r = 1.5 + Math.random() * 2.5;
      const t = Math.random() * Math.PI * 2;
      const p = Math.acos(2 * Math.random() - 1);
      positions[i * 3 + 0] = r * Math.sin(p) * Math.cos(t);
      positions[i * 3 + 1] = r * Math.sin(p) * Math.sin(t);
      positions[i * 3 + 2] = r * Math.cos(p);
      seeds[i] = Math.random();
    }
    pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    pGeo.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
    particleMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: orbUniforms.uTime,
        uColor: { value: GOLD },
        uSize: { value: 5.0 * renderer.getPixelRatio() },
      },
      vertexShader: `
        attribute float seed;
        uniform float uTime;
        uniform float uSize;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          float a = seed * 6.2831853 + uTime * 0.4;
          float pull = mod(uTime * 0.18 + seed, 1.0);
          p *= 1.0 - pull * 0.6;
          p.x += cos(a) * 0.15 * pull;
          p.y += sin(a) * 0.15 * pull;
          p.z += sin(a * 1.3) * 0.15 * pull;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uSize * (1.0 / -mv.z);
          vAlpha = 1.0 - pull;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          if (d > 0.5) discard;
          float a = (1.0 - d * 2.0) * vAlpha;
          gl_FragColor = vec4(uColor, a * 0.85);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    particles = new THREE.Points(pGeo, particleMat);
    scene.add(particles);
  }

  // -------- Animated point light orbiting the orb --------
  const orbitLight = new THREE.PointLight(GOLD, 1.0, 12, 1.2);
  scene.add(orbitLight);
  scene.add(new THREE.AmbientLight(0xffffff, 0.15));

  // -------- CTA beam (Line drawn from orb center to hovered CTA) --------
  const beamGeo = new THREE.BufferGeometry();
  beamGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const beamMat = new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0 });
  const beam = new THREE.Line(beamGeo, beamMat);
  scene.add(beam);
  const beamEnd = new THREE.Vector3();
  const beamTargetOpacity = { value: 0 };

  // -------- Postprocessing --------
  let composer = null;
  if (!prefersReduce) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.22, 0.5, 0.96
    );
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  // -------- Interaction state --------
  const cursorNDC = new THREE.Vector2(0, 0);
  const targetRot = { x: 0, y: 0 };
  let beamFrom = null; // {x,y} screen space

  canvas.style.pointerEvents = 'none';
  window.addEventListener('pointermove', (e) => {
    cursorNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
    cursorNDC.y = -((e.clientY / window.innerHeight) * 2 - 1);
    beamFrom = { x: e.clientX, y: e.clientY };
  }, { passive: true });

  // CTA hover detection via event delegation (works for any .cta added later).
  document.querySelectorAll('.cta').forEach((cta) => {
    cta.addEventListener('pointerenter', () => { beamTargetOpacity.value = 1; });
    cta.addEventListener('pointerleave', () => { beamTargetOpacity.value = 0; });
  });

  // Scroll-driven orb scale + fade out once past the hero. CSS handles the
  // opacity transition via .is-faded; we just toggle the class here.
  let scrollScale = 1;
  const heroEl = document.querySelector('main > section:first-of-type');
  function updateScroll() {
    if (!heroEl) return;
    const heroBottom = heroEl.getBoundingClientRect().bottom;
    // Fade once the hero is mostly out of view (bottom above 5% of viewport).
    const isFaded = heroBottom < window.innerHeight * 0.05;
    canvas.classList.toggle('is-faded', isFaded);
    // Scale 1.0 -> 0.7 across the hero scroll-out.
    const nextSection = heroEl.nextElementSibling;
    const nextTop = nextSection ? nextSection.getBoundingClientRect().top : window.innerHeight;
    const t = Math.min(Math.max((nextTop - heroBottom) / (window.innerHeight || 1), 0), 1);
    scrollScale = 1 - 0.3 * t;
  }
  window.addEventListener('scroll', updateScroll, { passive: true });
  updateScroll();

  // Resize.
  window.addEventListener('resize', () => {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    if (composer) composer.setSize(w, h);
  });

  // -------- Performance watchdog --------
  let frameTimes = [];
  let lastFrame = performance.now();
  let particleScale = 1;
  function watchdog(now) {
    const dt = now - lastFrame;
    frameTimes.push(dt);
    if (frameTimes.length > 5) frameTimes.shift();
    if (frameTimes.length === 5 && frameTimes.every(t => t > 20)) {
      if (particleScale === 1 && pGeo) {
        particleScale = 0.5;
        // ponytail: half the draw count via setDrawRange is cheaper than rebuilding
        // the buffer. Upgrade path: rebuild with 100 particles if this still fails.
        pGeo.setDrawRange(0, Math.floor(particleCount * 0.5));
      }
    }
    if (frameTimes.every(t => t < 12) && particleScale === 0.5) {
      particleScale = 1;
      pGeo.setDrawRange(0, particleCount);
    }
    lastFrame = now;
  }

  // -------- Render loop --------
  const ndc = new THREE.Vector3();
  const v = new THREE.Vector3();
  function tick(now) {
    const dt = Math.min((now - (tick.last || now)) / 1000, 0.05);
    tick.last = now;
    orbUniforms.uTime.value += dt;
    watchdog(now);

    if (!prefersReduce) {
      // Cursor parallax: lerp rotation toward cursor with elastic damping.
      targetRot.y = cursorNDC.x * 0.6;
      targetRot.x = -cursorNDC.y * 0.4;
      orb.rotation.y += (targetRot.y - orb.rotation.y) * 0.05;
      orb.rotation.x += (targetRot.x - orb.rotation.x) * 0.05;
    }

    // Orbital rings — each on its own axis/speed.
    rings[0].rotation.z += 0.5 * dt;
    rings[1].rotation.x += 0.3 * dt;
    rings[2].rotation.y += 0.7 * dt;

    // Orbiting light for moving highlights on the metal.
    const lt = orbUniforms.uTime.value * 0.7;
    orbitLight.position.set(Math.cos(lt) * 2.5, Math.sin(lt * 0.8) * 1.5, Math.sin(lt) * 2.5);

    // Scroll-driven uniform scale on the whole cluster.
    const s = scrollScale;
    orb.scale.set(s, s, s);
    rings.forEach(r => r.scale.set(s, s, s));
    if (particles) particles.scale.set(s, s, s);

    // CTA beam: project orb center + CTA screen pos to a z=0 world plane.
    beamMat.opacity += (beamTargetOpacity.value - beamMat.opacity) * 0.12;
    if (beamFrom && beamMat.opacity > 0.01) {
      const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
      ndc.set(0, 0, 0.5).unproject(camera);
      const orbWorld = ndc.clone();
      ndc.set((beamFrom.x / window.innerWidth) * 2 - 1, -((beamFrom.y / window.innerHeight) * 2 - 1), 0.5).unproject(camera);
      beamEnd.copy(ndc).sub(camera.position).setLength(orbWorld.distanceTo(camera.position) + 0.001).add(camera.position);
      const arr = beamGeo.attributes.position.array;
      arr[0] = orbWorld.x; arr[1] = orbWorld.y; arr[2] = orbWorld.z;
      arr[3] = beamEnd.x;  arr[4] = beamEnd.y;  arr[5] = beamEnd.z;
      beamGeo.attributes.position.needsUpdate = true;
    }

    if (composer) composer.render(dt); else renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // -------- Cleanup --------
  function dispose() {
    pmrem.dispose();
    orbGeo.dispose(); orbMat.dispose();
    ringGeo.dispose(); ringMat.dispose();
    rings.forEach(r => r.material.dispose());
    if (pGeo) pGeo.dispose();
    if (particleMat) particleMat.dispose();
    beamGeo.dispose(); beamMat.dispose();
    renderer.dispose();
    if (composer) { composer.passes.forEach(p => p.dispose && p.dispose()); }
  }
  window.addEventListener('pagehide', dispose, { once: true });
  // Cross-doc view transition hook: pause when hidden, resume on visible.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) renderer.setAnimationLoop(null);
  });
}
