import * as THREE from 'three';
import { LAYER_ORDER } from '../utils/graph';

// Scroll-driven WebGL scene. It is built from the real graph and the real power-outage simulation:
// node positions, dependency links, wave arrival and final health all come from the data.

const C = (h) => new THREE.Color(h);
const BONE = C('#ecefe9'), EMBER = C('#9fd3b4'), HOT = C('#ffe6ea'), RED = C('#ec6f85'), FAIL = C('#f28b9c'), REST = C('#9fd3b4');
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const hash = (i) => { const s = Math.sin(i * 127.1) * 43758.5453; return s - Math.floor(s); };

// Camera script. p = scroll progress; sep = layer separation; link = dependency visibility;
// c = cascade (0 = before the event, 1 = every wave done); r = restoration.
const SHOTS = [
  { p: 0.00, pos: [11, 7, 17], look: [-3.5, 0, 0], sep: 0.35, link: 0, c: 0, r: 0 },
  { p: 0.15, pos: [-10, 4, 17], look: [3.5, 0, 0], sep: 2.4, link: 0, c: 0, r: 0 },
  { p: 0.33, pos: [12, 2, 15], look: [-4, 0, 0], sep: 2.4, link: 1, c: 0, r: 0 },
  { p: 0.48, pos: [6, -3, 13], look: [3, -4.2, 0], sep: 2.4, link: 1, c: 0, r: 0 },
  { p: 0.56, pos: [6, -2.5, 13], look: [3, -3.8, 0], sep: 2.4, link: 1, c: 0.25, r: 0 },
  { p: 0.78, pos: [14, 5, 18], look: [-4, 0, 0], sep: 2.4, link: 1, c: 1, r: 0 },
  { p: 0.90, pos: [-9, 6, 17], look: [3.5, 0, 0], sep: 2.4, link: 0.6, c: 1, r: 1 },
  { p: 1.00, pos: [0.01, 19, 9], look: [0, -2, -3], sep: 0.7, link: 0, c: 1, r: 1 },
];

const POINT_VS = `
attribute float size; attribute vec3 color; varying vec3 vC; uniform float uPx;
void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0);
  gl_PointSize = size * uPx * (24.0 / -mv.z); gl_Position = projectionMatrix * mv; }`;
const POINT_FS = `
varying vec3 vC;
void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0) discard;
  float core = smoothstep(0.36, 0.22, d); float halo = exp(-d * d * 3.2) * 0.85;
  vec3 col = mix(vC, vec3(1.0), core * 0.25) * (core + halo);
  gl_FragColor = vec4(col, clamp(core + halo, 0.0, 1.0)); }`;

const pointMaterial = (px) => new THREE.ShaderMaterial({
  vertexShader: POINT_VS, fragmentShader: POINT_FS, uniforms: { uPx: { value: px } },
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});

const lineMaterial = () => new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });

export function createCityScene(canvas, { graph, sim, labels = {} }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  const px = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(px);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x111519, 0.018);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);

  // ---- data -> world space
  const nodes = graph.nodes;
  const idx = new Map(nodes.map((n, i) => [n.id, i]));
  const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const s = 12 / Math.max(maxX - minX, maxY - minY);
  const wx = nodes.map((n) => (n.x - (minX + maxX) / 2) * s);
  const wz = nodes.map((n) => (n.y - (minY + maxY) / 2) * s);
  const layerColor = Object.fromEntries(graph.layers.map((l) => [l.id, C(l.color)]));
  const layerY = (id, sep) => (2 - LAYER_ORDER.indexOf(id)) * sep; // power lowest, emergency on top
  const nodeY = (i, sep) => layerY(nodes[i].layer, sep);

  const arrival = nodes.map(() => Infinity);
  const health = nodes.map(() => 1);
  for (const h of sim.history) {
    const i = idx.get(h.target);
    if (i === undefined) continue;
    arrival[i] = Math.min(arrival[i], h.wave);
    health[i] = Math.min(health[i], h.health_after);
  }
  const base = nodes.map((n) => BONE.clone().lerp(layerColor[n.layer], 0.3));
  const W = sim.max_wave;

  // ---- layer slabs
  const slabs = [];
  const pw = (maxX - minX) * s + 2, ph = (maxY - minY) * s + 2;
  for (const l of graph.layers) {
    const g = new THREE.Group();
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshBasicMaterial({ color: layerColor[l.id], transparent: true, opacity: 0.045, depthWrite: false, side: THREE.DoubleSide }));
    plane.rotation.x = -Math.PI / 2;
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(pw, ph)), new THREE.LineBasicMaterial({ color: layerColor[l.id], transparent: true, opacity: 0.4 }));
    edge.rotation.x = -Math.PI / 2;
    g.add(plane, edge);
    scene.add(g);
    slabs.push({ id: l.id, g });
  }

  // ---- nodes
  const nPos = new Float32Array(nodes.length * 3), nCol = new Float32Array(nodes.length * 3), nSize = new Float32Array(nodes.length);
  const nGeo = new THREE.BufferGeometry();
  nGeo.setAttribute('position', new THREE.BufferAttribute(nPos, 3));
  nGeo.setAttribute('color', new THREE.BufferAttribute(nCol, 3));
  nGeo.setAttribute('size', new THREE.BufferAttribute(nSize, 1));
  const nodeMat = pointMaterial(px);
  const points = new THREE.Points(nGeo, nodeMat);
  points.frustumCulled = false;
  scene.add(points);

  // ---- lines: in-layer edges, cross-layer dependencies, cascade hops
  const mkLines = (pairs) => {
    const pos = new Float32Array(pairs.length * 6), col = new Float32Array(pairs.length * 6);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mesh = new THREE.LineSegments(geo, lineMaterial());
    mesh.frustumCulled = false;
    scene.add(mesh);
    return { pairs, pos, col, geo };
  };
  const edgeL = mkLines(graph.edges.map((e) => [idx.get(e.source), idx.get(e.target)]).filter((p) => p[0] !== undefined && p[1] !== undefined));
  const depL = mkLines(graph.dependencies.map((d) => [idx.get(d.provider), idx.get(d.dependent)]).filter((p) => p[0] !== undefined && p[1] !== undefined));
  const hops = sim.history.filter((h) => h.source && idx.has(h.source) && idx.has(h.target));
  const hopL = mkLines(hops.map((h) => [idx.get(h.source), idx.get(h.target)]));

  // ---- rising dust (ascension), deterministic
  const DUST = 220;
  const dPos = new Float32Array(DUST * 3), dCol = new Float32Array(DUST * 3), dSize = new Float32Array(DUST).fill(5);
  for (let i = 0; i < DUST; i++) {
    dPos[i * 3] = (hash(i) - 0.5) * 30; dPos[i * 3 + 1] = (hash(i + 400) - 0.5) * 20; dPos[i * 3 + 2] = (hash(i + 900) - 0.5) * 30;
    const c = i % 5 === 0 ? EMBER : BONE;
    dCol.set([c.r * 0.35, c.g * 0.35, c.b * 0.35], i * 3);
  }
  const dGeo = new THREE.BufferGeometry();
  dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  dGeo.setAttribute('color', new THREE.BufferAttribute(dCol, 3));
  dGeo.setAttribute('size', new THREE.BufferAttribute(dSize, 1));
  const dust = new THREE.Points(dGeo, pointMaterial(px));
  dust.frustumCulled = false;
  scene.add(dust);

  // ---- per-frame state
  const tmp = new THREE.Color(), tmp2 = new THREE.Color();
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  let target = 0, shown = 0, running = false, raf = 0, mx = 0, my = 0, smx = 0, smy = 0;
  const v = new THREE.Vector3();

  const shotAt = (p) => {
    let i = 0;
    while (i < SHOTS.length - 2 && p > SHOTS[i + 1].p) i++;
    const a = SHOTS[i], b = SHOTS[i + 1], k = smooth(a.p, b.p, p);
    const mix = (x, y) => x.map((q, j) => lerp(q, y[j], k));
    return { pos: mix(a.pos, b.pos), look: mix(a.look, b.look), sep: lerp(a.sep, b.sep, k), link: lerp(a.link, b.link, k), c: lerp(a.c, b.c, k), r: lerp(a.r, b.r, k) };
  };

  function frame(time) {
    raf = running ? requestAnimationFrame(frame) : 0;
    shown += (target - shown) * 0.07; // inertia
    smx += (mx - smx) * 0.05; smy += (my - smy) * 0.05;
    const sh = shotAt(shown);
    const t = sh.c <= 0 ? -1 : lerp(-1, W + 1.2, sh.c);

    camPos.set(sh.pos[0] + smx * 0.9, sh.pos[1] + smy * 0.5, sh.pos[2]);
    camLook.set(...sh.look);
    camera.position.copy(camPos);
    camera.lookAt(camLook);

    for (const sl of slabs) sl.g.position.y = layerY(sl.id, sh.sep);

    for (let i = 0; i < nodes.length; i++) {
      const y = nodeY(i, sh.sep);
      nPos.set([wx[i], y, wz[i]], i * 3);
      const act = smooth(arrival[i] - 0.5, arrival[i] + 0.3, t);
      const flash = act * (1 - smooth(arrival[i] + 0.3, arrival[i] + 1.7, t));
      const rr = smooth(hash(i) * 0.5, hash(i) * 0.5 + 0.5, sh.r);
      const sev = (1 - health[i]) * act * (1 - rr);
      tmp.copy(base[i]).lerp(tmp2.copy(FAIL).lerp(RED, 1 - health[i]), sev);
      tmp.multiplyScalar(1 - 0.55 * sev * smooth(arrival[i] + 0.8, arrival[i] + 2, t) * (1 - health[i]));
      tmp.lerp(HOT, flash * 0.8);
      const pulse = rr > 0 && rr < 1 ? Math.sin(rr * Math.PI) : 0;
      tmp.lerp(REST, pulse * 0.7);
      nCol.set([tmp.r, tmp.g, tmp.b], i * 3);
      nSize[i] = (12 + (nodes[i].criticality || 3) * 1.5) * (1 + 0.5 * flash + 0.35 * pulse);
    }
    nGeo.attributes.position.needsUpdate = nGeo.attributes.color.needsUpdate = nGeo.attributes.size.needsUpdate = true;

    const writeLines = (L, colorOf) => {
      L.pairs.forEach(([a, b], k) => {
        L.pos.set([wx[a], nodeY(a, sh.sep), wz[a], wx[b], nodeY(b, sh.sep), wz[b]], k * 6);
        const [r, g, bl] = colorOf(k, a, b);
        L.col.set([r, g, bl, r, g, bl], k * 6);
      });
      L.geo.attributes.position.needsUpdate = L.geo.attributes.color.needsUpdate = true;
    };
    writeLines(edgeL, () => [BONE.r * 0.2, BONE.g * 0.2, BONE.b * 0.2]);
    writeLines(depL, () => { const q = 0.5 * sh.link * (1 - 0.7 * smooth(0, 1, sh.c) * (1 - sh.r)); return [EMBER.r * q, EMBER.g * q, EMBER.b * q]; });
    writeLines(hopL, (k) => { const a = smooth(hops[k].wave - 0.6, hops[k].wave, t) * (1 - sh.r * 0.85); return [FAIL.r * a, FAIL.g * a, FAIL.b * a]; });

    // dust drifts upward and wraps
    const sec = time * 0.001;
    for (let i = 0; i < DUST; i++) {
      const yy = ((dPos[i * 3 + 1] + 10 + sec * (0.25 + hash(i + 7) * 0.5)) % 20) - 10;
      dGeo.attributes.position.array[i * 3 + 1] = yy;
    }
    dGeo.attributes.position.needsUpdate = true;

    // layer name labels follow their slab
    const hostW = canvas.clientWidth, hostH = canvas.clientHeight, show = smooth(0, 1, (sh.sep - 1.2) / 1.2);
    for (const l of graph.layers) {
      const el = labels[l.id];
      if (!el) continue;
      v.set(-pw / 2, layerY(l.id, sh.sep), ph / 2).project(camera);
      const vis = v.z < 1 && show > 0.05;
      el.style.opacity = vis ? String(show) : '0';
      el.style.transform = `translate(${(v.x * 0.5 + 0.5) * hostW}px, ${(-v.y * 0.5 + 0.5) * hostH}px)`;
    }
    renderer.render(scene, camera);
  }

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.9 ? 52 : 38; // portrait phones need a wider lens
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();
  const onMove = (e) => { mx = (e.clientX / window.innerWidth - 0.5) * 2; my = -(e.clientY / window.innerHeight - 0.5) * 2; };
  window.addEventListener('pointermove', onMove, { passive: true });

  return {
    setProgress: (p) => { target = clamp01(p); },
    setRunning: (on) => { if (on && !running) { running = true; raf = requestAnimationFrame(frame); } else if (!on) { running = false; } },
    dispose() {
      running = false; cancelAnimationFrame(raf); ro.disconnect();
      window.removeEventListener('pointermove', onMove);
      scene.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
      renderer.dispose();
    },
  };
}
