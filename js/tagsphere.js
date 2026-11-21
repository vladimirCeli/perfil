/* Interactive 3D skills cloud (2D canvas, no WebGL needed). Decorative: the skill groups below carry the same content. */
(function () {
  'use strict';

  var cv = document.getElementById('skillSphere');
  if (!cv || !window.SITE || !window.App) return;
  var ctx = cv.getContext('2d');
  if (!ctx) return;
  var REDUCED = window.App.reduced;

  var PAL = {
    dark: ['#6fa5ff', '#b49bff', '#4be0ad', '#ffd166', '#ff8da1', '#5fd4ff', '#f58ad6'],
    light: ['#1f5fd6', '#6d4fd8', '#0b8f66', '#a86b00', '#c2304f', '#0a7fb0', '#b02f94'],
  };
  // Curated highlights (the full list lives in the skill groups below). [label, color group]
  var PICK = [
    ['Elixir', 0], ['Erlang/OTP', 0], ['Webhooks', 0], ['BPMN', 0], ['Distributed systems', 0], ['Node.js', 0],
    ['Python', 1], ['Java', 1], ['JavaScript', 1], ['TypeScript', 1], ['SQL', 1],
    ['React', 2], ['Next.js', 2], ['Angular', 2], ['Vue.js', 2], ['React Native', 2], ['Flutter', 2],
    ['PostgreSQL', 3], ['MongoDB', 3], ['MySQL', 3],
    ['Git', 4], ['Linux', 4], ['CI/CD', 4], ['Containers', 4], ['AWS', 4],
    ['OWASP', 5], ['HMAC', 5],
    ['Claude API', 6], ['MCP', 6], ['Agent skills', 6],
  ];
  var words = PICK.map(function (p) { return { text: p[0], g: p[1], x: 0, y: 0, z: 0, d: 0, sx: 0, sy: 0, s: 1, a: 1 }; });
  var N = words.length;
  var PHI = Math.PI * (1 + Math.sqrt(5));
  words.forEach(function (w, i) {
    var y = 1 - ((i + 0.5) / N) * 2, r = Math.sqrt(1 - y * y), th = PHI * i;
    w.x = Math.cos(th) * r; w.y = y; w.z = Math.sin(th) * r;
  });

  var W = 0, H = 0, dpr = 1;
  var rotX = 0.35, rotY = 0;
  var vx = 0.0012, vy = 0.0042;       // current angular velocity (rad/frame at 60fps)
  var BASE_VY = 0.0042, BASE_VX = 0.0012;
  var dragging = false, lastX = 0, lastY = 0, pointerIn = false, mx = -999, my = -999;
  var hover = -1, visible = false, running = false, raf = 0, lastTs = 0, theme = 'dark';

  function resize() {
    var rect = cv.getBoundingClientRect();
    W = Math.max(200, Math.round(rect.width)); H = Math.max(200, Math.round(rect.height));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function project() {
    var cy = Math.cos(rotY), sy = Math.sin(rotY), cx = Math.cos(rotX), sx = Math.sin(rotX);
    var R = Math.min(W, H) * 0.38, f = 3.2;
    for (var i = 0; i < N; i++) {
      var w = words[i];
      var x1 = w.x * cy + w.z * sy, z1 = -w.x * sy + w.z * cy;     // rotate around Y
      var y2 = w.y * cx - z1 * sx, z2 = w.y * sx + z1 * cx;         // rotate around X
      var p = f / (f - z2);
      w.sx = W / 2 + x1 * R * p; w.sy = H / 2 + y2 * R * p;
      var near = (z2 + 1) / 2;
      w.d = z2; w.s = 0.6 + 0.6 * near; w.a = 0.1 + 0.9 * Math.pow(near, 1.7);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    project();
    var cols = PAL[theme];
    var R = Math.min(W, H) * 0.38;

    // faint orbit ellipses for a sense of volume
    ctx.lineWidth = 1;
    ctx.strokeStyle = theme === 'dark' ? 'rgba(130,165,255,.13)' : 'rgba(31,95,214,.14)';
    var cx = Math.cos(rotX), sx = Math.sin(rotX);
    ctx.beginPath(); ctx.ellipse(W / 2, H / 2, R, Math.max(4, Math.abs(sx) * R), 0, 0, 6.2832); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(W / 2, H / 2, Math.max(4, Math.abs(Math.cos(rotY)) * R), R, 0, 0, 6.2832); ctx.stroke();

    // depth sort (far first)
    var order = words.slice().sort(function (a, b) { return a.d - b.d; });
    hover = -1;
    var bestD = 26 * 26;
    if (pointerIn && !dragging) {
      for (var i = 0; i < N; i++) {
        var dx = words[i].sx - mx, dy = words[i].sy - my, dd = dx * dx + dy * dy;
        if (dd < bestD && words[i].d > -0.35) { bestD = dd; hover = i; }
      }
    }
    var base = Math.max(12, Math.min(W, H) * 0.043);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (var j = 0; j < order.length; j++) {
      var w = order[j];
      var isHover = hover >= 0 && words[hover] === w;
      var size = base * w.s * (isHover ? 1.35 : 1);
      ctx.font = (isHover ? '700 ' : '600 ') + size.toFixed(1) + 'px Inter, system-ui, sans-serif';
      ctx.globalAlpha = isHover ? 1 : w.a;
      ctx.fillStyle = cols[w.g % cols.length];
      if (isHover) { ctx.shadowColor = cols[w.g % cols.length]; ctx.shadowBlur = 14; }
      ctx.fillText(w.text, w.sx, w.sy);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
    cv.style.cursor = dragging ? 'grabbing' : (hover >= 0 ? 'pointer' : 'grab');
  }

  function loop(ts) {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    var k = Math.min(3, (ts - lastTs) / 16.67 || 1);
    lastTs = ts;
    if (!dragging) {
      // ease back to the idle spin; hovering slows the cloud so words are easy to read
      var slow = hover >= 0 ? 0.25 : 1;
      vx += (BASE_VX * slow - vx) * 0.03 * k;
      vy += (BASE_VY * slow - vy) * 0.03 * k;
      rotX += vx * k; rotY += vy * k;
    }
    draw();
  }
  function start() { if (running || REDUCED || !visible || document.hidden) return; running = true; lastTs = performance.now(); raf = requestAnimationFrame(loop); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  cv.addEventListener('pointerdown', function (e) {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    cv.classList.add('drag');
  });
  cv.addEventListener('pointermove', function (e) {
    var r = cv.getBoundingClientRect();
    mx = e.clientX - r.left; my = e.clientY - r.top; pointerIn = true;
    if (dragging) {
      var dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      rotY += dx * 0.008; rotX += dy * 0.008;
      vy = dx * 0.0016; vx = dy * 0.0016;       // inertia after release
      if (!running) draw();
    } else if (!running) draw();
  });
  function endDrag() { dragging = false; cv.classList.remove('drag'); }
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);
  cv.addEventListener('pointerleave', function () { pointerIn = false; mx = my = -999; if (!running) draw(); });

  window.addEventListener('themechange', function (e) { theme = e.detail === 'light' ? 'light' : 'dark'; draw(); });
  theme = window.App.getTheme();
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(cv); else window.addEventListener('resize', resize);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; visible ? start() : stop(); }, { threshold: 0.05 }).observe(cv);
  } else { visible = true; start(); }
  document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
  resize();
})();
