/*
 * 3D hero scene (three.js, vendored). A self-healing process network around the portrait:
 * nodes crash, a "supervisor" at the core restarts them, pulses travel along the links.
 * Progressive enhancement: any failure leaves the 2D canvas background running.
 */
import * as THREE from './vendor/three.module.min.js';

(function () {
  'use strict';

  var root = document.documentElement;
  var App = window.App;
  var canvas = document.getElementById('gl');
  var stage = document.getElementById('stage');
  if (!canvas || !stage || !App) return;
  var params = new URLSearchParams(location.search);
  if (params.has('nogl')) { console.info('[3D] disabled with ?nogl'); return; }
  var REDUCED = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { console.info('[3D] WebGL unavailable, keeping the 2D background'); return; }
  renderer.setClearColor(0x000000, 0);

  /* ------------------------------------------------------------ constants */
  var FOV = 40, CAM_Z = 11, R = 3.2, N = 44;
  var CORE = N; // index of the supervisor "core" node
  var MAX_PULSES = 64;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, 0, CAM_Z);
  var group = new THREE.Group();
  scene.add(group);

  function raw(hex) { return new THREE.Color().setStyle(hex, THREE.LinearSRGBColorSpace); } // no sRGB conversion (custom shaders)
  var PAL = {
    dark: { c1: '#2b66f5', c2: '#9a7bff', nodeA: '#62a0ff', nodeB: '#b49bff', good: '#34d399', bad: '#ff5d78', flash: '#e8fff6', dust: '#9fbcff', ring: '#6f9cff', additive: true, light: 0, edge: 0.55, ringOp: 0.5, dustOp: 0.7 },
    light: { c1: '#1f5fd6', c2: '#7a56e0', nodeA: '#1f5fd6', nodeB: '#6d4fd8', good: '#0f9d6e', bad: '#d6334f', flash: '#0b8f66', dust: '#3a62b8', ring: '#3a62c8', additive: false, light: 1, edge: 0.7, ringOp: 0.5, dustOp: 0.5 },
  };
  var pal = PAL[App.getTheme()];
  var C = {}; // cached raw colors for the current theme (avoids parsing strings every frame)
  function cacheColors() { C.a = raw(pal.nodeA); C.b = raw(pal.nodeB); C.bad = raw(pal.bad); C.flash = raw(pal.flash); C.good = raw(pal.good); }
  cacheColors();

  /* deterministic layout */
  function rng(seed) { return function () { seed = (seed + 0x6d2b79f5) | 0; var t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  var rand = rng(20261121);

  /* ------------------------------------------------------------- core blob */
  var blobMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 }, uAmp: { value: 1 }, uOpacity: { value: 1 }, uLight: { value: 0 },
      uC1: { value: raw(pal.c1) }, uC2: { value: raw(pal.c2) },
    },
    vertexShader: [
      'uniform float uTime; uniform float uAmp;',
      'varying vec3 vN; varying vec3 vView; varying vec3 vP;',
      'float f(vec3 p){',
      '  float t = uTime;',
      '  float a = sin(p.x*1.7+t*0.9)*sin(p.y*1.9-t*0.7)*sin(p.z*1.6+t*0.8);',
      '  float b = sin(p.x*3.6-t*1.3+p.y*2.1)*sin(p.z*3.2+t*1.1)*0.5;',
      '  return (a + b*0.6) * uAmp;',
      '}',
      'vec3 disp(vec3 p){ return p * (1.0 + f(p) * 0.28); }',
      'void main(){',
      '  vec3 p = normalize(position);',
      '  vec3 up = abs(p.y) < 0.99 ? vec3(0.0,1.0,0.0) : vec3(1.0,0.0,0.0);',
      '  vec3 t1 = normalize(cross(p, up));',
      '  vec3 t2 = cross(p, t1);',
      '  float e = 0.02;',
      '  vec3 p0 = disp(p);',
      '  vec3 p1 = disp(normalize(p + t1*e));',
      '  vec3 p2 = disp(normalize(p + t2*e));',
      '  vec3 n = normalize(cross(p1 - p0, p2 - p0));',
      '  if (dot(n, p) < 0.0) n = -n;',
      '  vec4 mv = modelViewMatrix * vec4(p0, 1.0);',
      '  vN = normalize(normalMatrix * n);',
      '  vView = -mv.xyz;',
      '  vP = p0;',
      '  gl_Position = projectionMatrix * mv;',
      '}',
    ].join('\n'),
    fragmentShader: [
      'uniform float uTime; uniform float uOpacity; uniform float uLight;',
      'uniform vec3 uC1; uniform vec3 uC2;',
      'varying vec3 vN; varying vec3 vView; varying vec3 vP;',
      'void main(){',
      '  vec3 N = normalize(vN); vec3 V = normalize(vView);',
      '  float fr = pow(1.0 - max(dot(N, V), 0.0), 2.2);',
      '  float g = 0.5 + 0.5*sin(vP.y*2.6 + vP.x*1.6 + uTime*0.6);',
      '  vec3 col = mix(uC1, uC2, g);',
      '  vec3 irid = 0.5 + 0.5*cos(6.2831*(vec3(0.0,0.33,0.67) + fr*0.8 + uTime*0.05));',
      '  col = mix(col, irid, fr*0.5);',
      '  col += fr * mix(0.3, 0.0, uLight);',
      '  float a = (0.34 + fr*0.7) * uOpacity;',
      '  gl_FragColor = vec4(col, a);',
      '}',
    ].join('\n'),
  });
  var blob = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 28), blobMat);
  blob.scale.setScalar(R * 0.56);
  group.add(blob);

  /* ------------------------------------------------------------ nodes + links */
  var nodes = [];
  var golden = Math.PI * (1 + Math.sqrt(5));
  for (var i = 0; i < N; i++) {
    var y = 1 - ((i + 0.5) / N) * 2, rr = Math.sqrt(1 - y * y), th = golden * i;
    var rad = R * (0.8 + rand() * 0.34);
    nodes.push({
      base: new THREE.Vector3(Math.cos(th) * rr, y, Math.sin(th) * rr).multiplyScalar(rad),
      pos: new THREE.Vector3(), phase: rand() * 6.28, hue: rand() < 0.68 ? 0 : 1, size: 0.55 + rand() * 0.3,
      crashed: false, restartAt: 0, flashAt: -9, col: new THREE.Color(), sz: 0,
    });
  }
  nodes.push({ base: new THREE.Vector3(), pos: new THREE.Vector3(), phase: 0, hue: 0, size: 0, crashed: false, restartAt: 0, flashAt: -9, col: new THREE.Color(), sz: 0 });

  var edges = [], edgeKeys = {};
  function addEdge(a, b) { var k = a < b ? a + '-' + b : b + '-' + a; if (edgeKeys[k]) return; edgeKeys[k] = 1; edges.push([a, b]); }
  for (var a = 0; a < N; a++) {
    var d = [];
    for (var b = 0; b < N; b++) if (b !== a) d.push([b, nodes[a].base.distanceToSquared(nodes[b].base)]);
    d.sort(function (p, q) { return p[1] - q[1]; });
    for (var k = 0; k < 3; k++) addEdge(a, d[k][0]);
  }
  for (var c = 0; c < N; c += 6) addEdge(CORE, c);

  var POINT_VERT = [
    'attribute vec3 aColor; attribute float aSize; attribute float aAlpha;',
    'uniform float uScale; uniform float uPx;',
    'varying vec3 vColor; varying float vAlpha;',
    'void main(){',
    '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
    '  gl_Position = projectionMatrix * mv;',
    '  gl_PointSize = max(2.0, aSize * uScale * uPx / -mv.z);',
    '  vColor = aColor; vAlpha = aAlpha;',
    '}',
  ].join('\n');
  var POINT_FRAG = [
    'uniform float uOpacity; uniform float uLight;',
    'varying vec3 vColor; varying float vAlpha;',
    'void main(){',
    '  float d = length(gl_PointCoord - 0.5) * 2.0;',
    '  if (d > 1.0) discard;',
    '  float core = smoothstep(0.42, 0.0, d);',
    '  float glow = pow(1.0 - d, 2.2);',
    '  vec3 col = vColor * (0.7 + core * mix(0.9, 0.2, uLight));',
    '  float a = (glow * 0.85 + core) * vAlpha * uOpacity;',
    '  gl_FragColor = vec4(col, a);',
    '}',
  ].join('\n');
  function pointMaterial() {
    return new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      blending: pal.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uScale: { value: 520 }, uPx: { value: 1 }, uOpacity: { value: 1 }, uLight: { value: pal.light } },
      vertexShader: POINT_VERT, fragmentShader: POINT_FRAG,
    });
  }

  // nodes as glowing points
  var nodeGeo = new THREE.BufferGeometry();
  var nPos = new Float32Array(N * 3), nCol = new Float32Array(N * 3), nSize = new Float32Array(N), nAlpha = new Float32Array(N).fill(1);
  nodeGeo.setAttribute('position', new THREE.BufferAttribute(nPos, 3));
  nodeGeo.setAttribute('aColor', new THREE.BufferAttribute(nCol, 3));
  nodeGeo.setAttribute('aSize', new THREE.BufferAttribute(nSize, 1));
  nodeGeo.setAttribute('aAlpha', new THREE.BufferAttribute(nAlpha, 1));
  var nodeMat = pointMaterial();
  var nodePoints = new THREE.Points(nodeGeo, nodeMat);
  nodePoints.frustumCulled = false;
  group.add(nodePoints);

  // pulses traveling along links
  var pulseGeo = new THREE.BufferGeometry();
  var pPos = new Float32Array(MAX_PULSES * 3), pCol = new Float32Array(MAX_PULSES * 3), pSize = new Float32Array(MAX_PULSES), pAlpha = new Float32Array(MAX_PULSES);
  pulseGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pulseGeo.setAttribute('aColor', new THREE.BufferAttribute(pCol, 3));
  pulseGeo.setAttribute('aSize', new THREE.BufferAttribute(pSize, 1));
  pulseGeo.setAttribute('aAlpha', new THREE.BufferAttribute(pAlpha, 1));
  pulseGeo.setDrawRange(0, 0);
  var pulseMat = pointMaterial();
  var pulsePoints = new THREE.Points(pulseGeo, pulseMat);
  pulsePoints.frustumCulled = false;
  group.add(pulsePoints);
  var pulses = [];

  // links
  var lineGeo = new THREE.BufferGeometry();
  var lPos = new Float32Array(edges.length * 6), lCol = new Float32Array(edges.length * 6);
  lineGeo.setAttribute('position', new THREE.BufferAttribute(lPos, 3));
  lineGeo.setAttribute('aColor', new THREE.BufferAttribute(lCol, 3));
  var lineMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    blending: pal.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: { uOpacity: { value: 1 }, uEdge: { value: pal.edge } },
    vertexShader: 'attribute vec3 aColor; varying vec3 vC; void main(){ vC = aColor; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float uOpacity; uniform float uEdge; varying vec3 vC; void main(){ gl_FragColor = vec4(vC, uEdge * uOpacity); }',
  });
  var lines = new THREE.LineSegments(lineGeo, lineMat);
  lines.frustumCulled = false;
  group.add(lines);

  // orbit rings: seen in perspective they read as ovals
  var rings = [];
  [[R * 0.7, 1.15, 0.2], [R * 0.92, 0.45, -0.6], [R * 1.12, 1.45, 0.9]].forEach(function (cfg, idx) {
    var mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(pal.ring), transparent: true, opacity: pal.ringOp, depthWrite: false, blending: pal.additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    var m = new THREE.Mesh(new THREE.TorusGeometry(cfg[0], 0.014, 6, 220), mat);
    m.rotation.set(cfg[1], cfg[2], idx * 0.8);
    m.userData.spin = (idx % 2 ? -1 : 1) * (0.05 + idx * 0.025);
    group.add(m);
    rings.push(m);
  });

  // distant dust
  var DUST = 700;
  var dustPos = new Float32Array(DUST * 3);
  for (var s = 0; s < DUST; s++) {
    var u = rand() * 2 - 1, ph = rand() * 6.2832, rd = 9 + rand() * 11, sq = Math.sqrt(1 - u * u);
    dustPos[s * 3] = Math.cos(ph) * sq * rd; dustPos[s * 3 + 1] = u * rd * 0.7; dustPos[s * 3 + 2] = Math.sin(ph) * sq * rd - 4;
  }
  var dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  var dustMat = new THREE.PointsMaterial({ color: new THREE.Color(pal.dust), size: 0.045, transparent: true, opacity: pal.dustOp, depthWrite: false, sizeAttenuation: true, blending: pal.additive ? THREE.AdditiveBlending : THREE.NormalBlending });
  var dust = new THREE.Points(dustGeo, dustMat);
  scene.add(dust);

  /* ----------------------------------------------------------------- theme */
  function applyTheme() {
    pal = PAL[App.getTheme()];
    cacheColors();
    var blend = pal.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
    [nodeMat, pulseMat, lineMat, dustMat].concat(rings.map(function (r) { return r.material; })).forEach(function (m) { m.blending = blend; m.needsUpdate = true; });
    blobMat.uniforms.uC1.value.copy(raw(pal.c1)); blobMat.uniforms.uC2.value.copy(raw(pal.c2)); blobMat.uniforms.uLight.value = pal.light;
    nodeMat.uniforms.uLight.value = pulseMat.uniforms.uLight.value = pal.light;
    lineMat.uniforms.uEdge.value = pal.edge;
    dustMat.color.set(pal.dust); dustMat.opacity = pal.dustOp;
    rings.forEach(function (r) { r.material.color.set(pal.ring); r.material.opacity = pal.ringOp; });
    renderOnce();
  }

  /* ------------------------------------------------------ crash / restart sim */
  var restarts = 0, lastAuto = 0, nextAuto = 2.4;
  var cA = C.a, cB = C.b, tmp = C.a; // reassigned to cached colors; never mutated
  function spawnPulse(a, b, kind) {
    if (pulses.length >= MAX_PULSES) pulses.shift();
    pulses.push({ a: a, b: b, t: 0, speed: 0.55 + Math.random() * 0.6, kind: kind || 0 });
  }
  function crash(i, byUser, now) {
    var n = nodes[i];
    if (!n || n.crashed || i === CORE) return false;
    n.crashed = true;
    n.restartAt = now + 1.3 + Math.random() * 0.9;
    if (byUser) for (var k = 0; k < 3; k++) spawnPulse(i, Math.floor(Math.random() * N), 2);
    return true;
  }
  function crashRandom(now, byUser) {
    var healthy = [];
    for (var i = 0; i < N; i++) if (!nodes[i].crashed) healthy.push(i);
    if (!healthy.length) return false;
    return crash(healthy[Math.floor(Math.random() * healthy.length)], byUser, now);
  }
  var hudText = document.getElementById('hudText');
  var hud = document.getElementById('crashHud');
  var crashBtn = document.getElementById('crashBtn');
  function setHud() {
    if (!hudText) return;
    hudText.textContent = String(App.t('hero.hud')).replace('{n}', restarts);
  }

  function updateNodes(t) {
    var i, n, k;
    for (i = 0; i < N; i++) {
      n = nodes[i];
      var bob = 1 + 0.035 * Math.sin(t * 0.7 + n.phase);
      n.pos.copy(n.base).multiplyScalar(bob);
      n.pos.x += Math.sin(t * 0.5 + n.phase * 1.7) * 0.05;
      n.pos.y += Math.cos(t * 0.45 + n.phase * 1.3) * 0.05;

      if (n.crashed && t >= n.restartAt) { // supervisor restarts the process
        n.crashed = false; n.flashAt = t; restarts++;
        spawnPulse(CORE, i, 1); spawnPulse(CORE, i, 1);
        setHud();
      }
      n.col.copy(n.hue ? C.b : C.a);
      var size = n.size;
      if (n.crashed) {
        var fl = 0.55 + 0.45 * Math.sin(t * 38 + n.phase);
        n.col.lerp(C.bad, 0.75 + 0.25 * fl);
        size *= 1.25 + 0.2 * fl;
        n.pos.x += (Math.random() - 0.5) * 0.07; n.pos.y += (Math.random() - 0.5) * 0.07; n.pos.z += (Math.random() - 0.5) * 0.07;
      } else if (t - n.flashAt < 0.9) {
        var f = 1 - (t - n.flashAt) / 0.9;
        n.col.lerp(C.flash, f);
        size *= 1 + 1.3 * f * f;
      }
      if (i === hoverIdx) size *= 1.5;
      n.sz = size;
      nPos[i * 3] = n.pos.x; nPos[i * 3 + 1] = n.pos.y; nPos[i * 3 + 2] = n.pos.z;
      nCol[i * 3] = n.col.r; nCol[i * 3 + 1] = n.col.g; nCol[i * 3 + 2] = n.col.b;
      nSize[i] = size;
    }
    nodeGeo.attributes.position.needsUpdate = nodeGeo.attributes.aColor.needsUpdate = nodeGeo.attributes.aSize.needsUpdate = true;

    for (k = 0; k < edges.length; k++) {
      var A = nodes[edges[k][0]], B = nodes[edges[k][1]];
      lPos[k * 6] = A.pos.x; lPos[k * 6 + 1] = A.pos.y; lPos[k * 6 + 2] = A.pos.z;
      lPos[k * 6 + 3] = B.pos.x; lPos[k * 6 + 4] = B.pos.y; lPos[k * 6 + 5] = B.pos.z;
      var m = (A.crashed || B.crashed) ? 0.9 : 0.55;
      cA = A.crashed ? C.bad : (A.hue ? C.b : C.a);
      cB = B.crashed ? C.bad : (B.hue ? C.b : C.a);
      lCol[k * 6] = cA.r * m; lCol[k * 6 + 1] = cA.g * m; lCol[k * 6 + 2] = cA.b * m;
      lCol[k * 6 + 3] = cB.r * m; lCol[k * 6 + 4] = cB.g * m; lCol[k * 6 + 5] = cB.b * m;
    }
    lineGeo.attributes.position.needsUpdate = lineGeo.attributes.aColor.needsUpdate = true;
  }

  function updatePulses(dt) {
    var live = 0;
    for (var i = pulses.length - 1; i >= 0; i--) {
      var p = pulses[i];
      p.t += dt * p.speed;
      if (p.t >= 1) { pulses.splice(i, 1); }
    }
    for (var j = 0; j < pulses.length; j++) {
      var q = pulses[j], A = nodes[q.a].pos, B = nodes[q.b].pos, e = q.t * q.t * (3 - 2 * q.t);
      pPos[live * 3] = A.x + (B.x - A.x) * e; pPos[live * 3 + 1] = A.y + (B.y - A.y) * e; pPos[live * 3 + 2] = A.z + (B.z - A.z) * e;
      tmp = q.kind === 1 ? C.good : q.kind === 2 ? C.bad : (q.a % 2 ? C.b : C.a);
      pCol[live * 3] = tmp.r; pCol[live * 3 + 1] = tmp.g; pCol[live * 3 + 2] = tmp.b;
      pSize[live] = q.kind === 0 ? 0.42 : 0.62;
      pAlpha[live] = Math.sin(Math.PI * q.t);
      live++;
    }
    pulseGeo.setDrawRange(0, live);
    pulseGeo.attributes.position.needsUpdate = pulseGeo.attributes.aColor.needsUpdate = pulseGeo.attributes.aSize.needsUpdate = pulseGeo.attributes.aAlpha.needsUpdate = true;
  }

  /* ------------------------------------------------------------ layout & scroll */
  var vw = 1, vh = 1, pr = 1;
  var cur = { x: 0, y: 0, s: 1, o: 1 }, hasCur = false;
  var pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  var scrollK = 0, scrollY = 0;
  var hoverIdx = -1;
  var qualityDrops = 0;
  function sm(a, b, x) { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); }

  function resize() {
    vw = window.innerWidth; vh = window.innerHeight;
    pr = Math.min(window.devicePixelRatio || 1, vw < 700 ? 1.5 : 1.75) / (qualityDrops > 0 ? 1.4 : 1);
    pr = Math.max(1, pr);
    renderer.setPixelRatio(pr);
    renderer.setSize(vw, vh, false);
    camera.aspect = vw / vh;
    camera.updateProjectionMatrix();
    nodeMat.uniforms.uPx.value = pr; pulseMat.uniforms.uPx.value = pr;
  }

  function layout(dt) {
    var rect = stage.getBoundingClientRect();
    var halfH = Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * CAM_Z, halfW = halfH * camera.aspect;
    var wpp = (2 * halfH) / vh;
    var desktop = vw >= 960;
    var cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    var stageX = (cx / vw * 2 - 1) * halfW, stageY = -(cy / vh * 2 - 1) * halfH;
    var stageS = (rect.width * 0.5 * wpp) / R * 1.02;
    var ambX = desktop ? halfW * 0.5 : 0, ambY = Math.sin(scrollY * 0.0006) * halfH * 0.22 - halfH * 0.04;
    var ambS = (Math.min(vw, vh) * (desktop ? 0.4 : 0.34) * wpp) / R;
    var ambO = desktop ? 0.42 : 0.24;
    scrollK = sm(0.08, 0.8, scrollY / vh);
    var tx = stageX + (ambX - stageX) * scrollK, ty = stageY + (ambY - stageY) * scrollK;
    var ts = stageS + (ambS - stageS) * scrollK, to = 1 + (ambO - 1) * scrollK;
    if (!hasCur) { cur.x = tx; cur.y = ty; cur.s = ts; cur.o = to; hasCur = true; }
    else {
      var k = 1 - Math.exp(-dt * 7);
      cur.x += (tx - cur.x) * k; cur.y += (ty - cur.y) * k; cur.s += (ts - cur.s) * k; cur.o += (to - cur.o) * k;
    }
    group.position.set(cur.x, cur.y, 0);
    group.scale.setScalar(cur.s);
    var opacity = cur.o;
    blobMat.uniforms.uOpacity.value = opacity; nodeMat.uniforms.uOpacity.value = opacity; pulseMat.uniforms.uOpacity.value = opacity; lineMat.uniforms.uOpacity.value = opacity;
    rings.forEach(function (r) { r.material.opacity = pal.ringOp * opacity; });
    dustMat.opacity = pal.dustOp * (0.5 + 0.5 * opacity);
    nodeMat.uniforms.uScale.value = 520 * 1; pulseMat.uniforms.uScale.value = 520;
  }

  /* ------------------------------------------------------------------ frame */
  var clockStart = performance.now(), lastT = 0, running = false, raf = 0;
  var emaMs = 16, frames = 0, warm = 0, fatal = false;
  var tAbs = 2.0;

  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    var t = (now - clockStart) / 1000;
    var dt = Math.min(0.05, Math.max(0.001, t - lastT));
    lastT = t;
    step(t, dt);
    // adaptive quality
    emaMs += (dt * 1000 - emaMs) * 0.05;
    frames++;
    if (frames === 120 && emaMs > 30 && qualityDrops === 0) { qualityDrops = 1; resize(); frames = 0; console.info('[3D] lowering resolution (' + emaMs.toFixed(1) + ' ms/frame)'); }
    else if (frames === 180 && emaMs > 36 && qualityDrops === 1) { qualityDrops = 2; shutdown('too slow'); }
    window.__gl = { fps: Math.round(1000 / emaMs), ms: +emaMs.toFixed(1), pr: pr, restarts: restarts, pulses: pulses.length };
  }

  function step(t, dt) {
    tAbs = t;
    scrollY = window.scrollY || 0;
    // pointer smoothing
    pointer.sx += (pointer.x - pointer.sx) * (1 - Math.exp(-dt * 4)); pointer.sy += (pointer.y - pointer.sy) * (1 - Math.exp(-dt * 4));
    blobMat.uniforms.uTime.value = t;
    blobMat.uniforms.uAmp.value = 1;
    group.rotation.y = t * 0.11 + scrollY * 0.0011 + pointer.sx * 0.35;
    group.rotation.x = 0.18 + pointer.sy * 0.22 + Math.sin(t * 0.2) * 0.05;
    rings.forEach(function (r) { r.rotation.z += r.userData.spin * dt; r.rotation.y += r.userData.spin * 0.4 * dt; });
    dust.rotation.y = t * 0.012 + scrollY * 0.00025;
    dust.position.y = scrollY * 0.0006;

    if (!REDUCED && t - lastAuto > nextAuto) { crashRandom(t, false); lastAuto = t; nextAuto = 2.2 + Math.random() * 2.6; }
    layout(dt);
    updateNodes(t);
    updatePulses(dt);
    if (!REDUCED && Math.random() < dt * 5) { var e = edges[Math.floor(Math.random() * edges.length)]; if (Math.random() < 0.5) spawnPulse(e[0], e[1], 0); else spawnPulse(e[1], e[0], 0); }
    renderer.render(scene, camera);
  }

  function renderOnce() { if (!running) { lastT = tAbs; step(tAbs, 0.016); } }
  /* With "reduce motion" the scene stays still on its own, but animations the visitor triggers (a crash and its recovery) still play for a few seconds. */
  var burstTimer = 0;
  function burst() {
    if (!REDUCED) { renderOnce(); return; }
    start();
    clearTimeout(burstTimer);
    burstTimer = setTimeout(function () { if (REDUCED) stop(); }, 4500);
  }

  function start() { if (running || fatal) return; running = true; lastT = (performance.now() - clockStart) / 1000; raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  function shutdown(reason) {
    console.info('[3D] shutting down: ' + reason);
    fatal = true; stop();
    root.classList.remove('gl');
    if (hud) hud.hidden = true;
    if (App.bg) App.bg.start();
  }

  /* ----------------------------------------------------------- interaction */
  var projV = new THREE.Vector3();
  function pick(px, py, radius) {
    group.updateMatrixWorld(true);
    var best = -1, bd = radius * radius;
    for (var i = 0; i < N; i++) {
      projV.copy(nodes[i].pos).applyMatrix4(group.matrixWorld).project(camera);
      if (projV.z > 1) continue;
      var sx = (projV.x * 0.5 + 0.5) * vw, sy = (-projV.y * 0.5 + 0.5) * vh;
      var dd = (sx - px) * (sx - px) + (sy - py) * (sy - py);
      if (dd < bd) { bd = dd; best = i; }
    }
    return best;
  }
  window.addEventListener('pointermove', function (e) {
    pointer.x = (e.clientX / vw) * 2 - 1; pointer.y = (e.clientY / vh) * 2 - 1;
  }, { passive: true });
  stage.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse') return;
    var h = pick(e.clientX, e.clientY, 26);
    if (h !== hoverIdx) { hoverIdx = h; stage.style.cursor = h >= 0 ? 'pointer' : ''; }
  });
  stage.addEventListener('pointerleave', function () { hoverIdx = -1; stage.style.cursor = ''; });
  stage.addEventListener('pointerdown', function (e) {
    var i = pick(e.clientX, e.clientY, e.pointerType === 'mouse' ? 30 : 44);
    if (i >= 0) { crash(i, true, tAbs); burst(); }
  });
  if (crashBtn) crashBtn.addEventListener('click', function () { crashRandom(tAbs, true); burst(); });

  window.addEventListener('resize', function () { resize(); renderOnce(); });
  window.addEventListener('scroll', function () { if (!running) renderOnce(); }, { passive: true });
  window.addEventListener('themechange', applyTheme);
  window.addEventListener('langchange', setHud);
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else if (!REDUCED) start(); });
  canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); shutdown('context lost'); });

  /* ------------------------------------------------------------------ boot */
  resize();
  step(2.0, 0.016);               // first frame
  root.classList.add('gl');       // reveal the canvas, hide the 2D fallback
  if (App.bg) App.bg.stop();
  if (hud) {
    hud.hidden = false; setHud();
  }
  if (!REDUCED) start();
  window.GL3D = { ok: true, screenOf: function (i) { group.updateMatrixWorld(true); projV.copy(nodes[i].pos).applyMatrix4(group.matrixWorld).project(camera); return { x: (projV.x * 0.5 + 0.5) * vw, y: (-projV.y * 0.5 + 0.5) * vh, crashed: nodes[i].crashed }; }, crash: function () { return crashRandom(tAbs, true); }, state: function () { return { restarts: restarts, running: running, pulses: pulses.length, crashed: nodes.filter(function (n) { return n.crashed; }).length, nodes: N }; }, stop: stop, start: start };
})();
