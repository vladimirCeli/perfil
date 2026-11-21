/* Game UIs. All rules live in cores.js (unit-tested); this file only renders and handles input. */
(function () {
  'use strict';

  var App = window.App;
  var Snake = window.Cores.Snake;
  var Memory = window.Cores.Memory;
  var Crash = window.Cores.Crash;
  var t = App.t;

  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function bestGet(k) { var v = parseInt(App.store(k), 10); return isFinite(v) ? v : null; }
  function setOverlay(overlay, msgEl, title, sub) {
    msgEl.textContent = title;
    if (sub) { var s = App.el('small', null, sub); msgEl.appendChild(s); }
    overlay.hidden = false;
  }

  var pausers = []; // functions that pause a running game

  /* ================================================================= SNAKE */
  var snake = (function () {
    var SIZE = 18;
    var canvas = $('#snakeCanvas');
    var ctx = canvas.getContext('2d');
    var overlay = $('#snakeOverlay'), msg = $('#snakeMsg'), startBtn = $('#snakeStart'), pauseBtn = $('#snakePause');
    var scoreEl = $('#snakeScore'), bestEl = $('#snakeBest');
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var CSS = 360;
    canvas.width = CSS * dpr; canvas.height = CSS * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var cell = CSS / SIZE;

    var state = null, mode = 'idle', timer = null, best = bestGet('vc-snake-best') || 0, lastResult = null;
    bestEl.textContent = best;

    function lerp(a, b, p) { return Math.round(a + (b - a) * p); }
    function draw() {
      ctx.fillStyle = '#060d1f';
      ctx.fillRect(0, 0, CSS, CSS);
      ctx.fillStyle = 'rgba(120,150,230,.10)';
      for (var y = 0; y < SIZE; y++) for (var x = 0; x < SIZE; x++) ctx.fillRect(x * cell + cell / 2 - 1, y * cell + cell / 2 - 1, 2, 2);
      if (!state) return;
      if (state.food) {
        var f = state.food;
        ctx.shadowColor = '#fb7185'; ctx.shadowBlur = 12;
        ctx.fillStyle = '#fb7185';
        ctx.beginPath(); ctx.arc(f.x * cell + cell / 2, f.y * cell + cell / 2, cell * 0.34, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      }
      var n = state.snake.length;
      for (var i = n - 1; i >= 0; i--) {
        var p = state.snake[i], k = n > 1 ? i / (n - 1) : 0;
        ctx.fillStyle = 'rgb(' + lerp(79, 120, k) + ',' + lerp(141, 90, k) + ',' + lerp(255, 220, k) + ')';
        var pad = i === 0 ? 1 : 2;
        roundRect(p.x * cell + pad, p.y * cell + pad, cell - pad * 2, cell - pad * 2, 5);
      }
      var h = state.snake[0], d = Snake.DIRS[state.dir];
      ctx.fillStyle = '#041022';
      var ex = h.x * cell + cell / 2 + d.x * 3, ey = h.y * cell + cell / 2 + d.y * 3;
      var ox = d.y !== 0 ? 4 : 0, oy = d.x !== 0 ? 4 : 0;
      ctx.beginPath(); ctx.arc(ex - ox, ey - oy, 1.7, 0, 7); ctx.arc(ex + ox, ey + oy, 1.7, 0, 7); ctx.fill();
    }
    function roundRect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fill();
    }

    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(tick, Snake.delay(state.score));
    }
    function tick() {
      if (mode !== 'running') return;
      Snake.step(state);
      scoreEl.textContent = state.score;
      draw();
      if (!state.alive) return finish();
      schedule();
    }
    function finish() {
      clearTimeout(timer);
      mode = 'over';
      canvas.classList.remove('playing');
      pauseBtn.hidden = true;
      if (state.score > best) { best = state.score; App.store('vc-snake-best', String(best)); bestEl.textContent = best; }
      lastResult = state.won ? 'win' : 'over';
      showEnd();
    }
    function showEnd() {
      setOverlay(overlay, msg, t(lastResult === 'win' ? 'play.snakeWin' : 'play.snakeOver'), t('play.score') + ': ' + state.score);
      startBtn.textContent = t('play.again');
    }
    function start() {
      clearTimeout(timer);
      state = Snake.create(SIZE);
      mode = 'running';
      scoreEl.textContent = '0';
      overlay.hidden = true;
      pauseBtn.hidden = false;
      setPauseLabel();
      canvas.classList.add('playing');
      draw();
      try { canvas.focus({ preventScroll: true }); } catch (e) { canvas.focus(); }
      schedule();
    }
    function pause() {
      if (mode !== 'running') return;
      clearTimeout(timer);
      mode = 'paused';
      setOverlay(overlay, msg, t('play.paused'));
      startBtn.textContent = t('play.resume');
      setPauseLabel();
    }
    function resume() {
      if (mode !== 'paused') return;
      mode = 'running';
      overlay.hidden = true;
      setPauseLabel();
      try { canvas.focus({ preventScroll: true }); } catch (e) { canvas.focus(); }
      schedule();
    }
    function setPauseLabel() {
      var span = $('span', pauseBtn);
      span.textContent = t(mode === 'paused' ? 'play.resume' : 'play.pause');
    }
    pausers.push(pause);

    startBtn.addEventListener('click', function () { mode === 'paused' ? resume() : start(); });
    pauseBtn.addEventListener('click', function () { mode === 'paused' ? resume() : pause(); });

    var KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' };
    document.addEventListener('keydown', function (e) {
      if (mode !== 'running' && mode !== 'paused') return;
      if ($('#panel-snake').hidden) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === ' ' || e.code === 'Space') {
        if (e.target && e.target.tagName === 'BUTTON') return; // native button activation handles it
        e.preventDefault();
        mode === 'paused' ? resume() : pause();
        return;
      }
      var dir = KEYS[e.key];
      if (!dir || mode !== 'running') return;
      var tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      Snake.turn(state, dir);
    });

    // Swipe on the board
    var sx = 0, sy = 0, tracking = false;
    canvas.addEventListener('pointerdown', function (e) { tracking = true; sx = e.clientX; sy = e.clientY; });
    canvas.addEventListener('pointermove', function (e) {
      if (!tracking || mode !== 'running') return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
      Snake.turn(state, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
      sx = e.clientX; sy = e.clientY;
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { canvas.addEventListener(ev, function () { tracking = false; }); });

    // On-screen pad
    $$('.dpad button').forEach(function (b) {
      b.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        if (mode === 'running') Snake.turn(state, b.getAttribute('data-dir'));
      });
    });

    function refreshText() {
      setPauseLabel();
      if (mode === 'paused') { setOverlay(overlay, msg, t('play.paused')); startBtn.textContent = t('play.resume'); }
      else if (mode === 'over') showEnd();
      else if (mode === 'idle') { msg.textContent = 'Snake'; startBtn.textContent = t('play.start'); }
    }
    msg.textContent = 'Snake';
    draw();
    return { refreshText: refreshText, isRunning: function () { return mode === 'running'; } };
  })();

  /* ================================================================ MEMORY */
  var memory = (function () {
    var SYMBOLS = [
      ['Elixir', '#7c4dff'], ['Erlang', '#d6455d'], ['Java', '#b86a12'], ['JS', '#8a6f00'],
      ['Python', '#2f6db5'], ['SQL', '#1f8a70'], ['React', '#0e8fb3'], ['Git', '#d6452b'],
    ];
    var COLORS = {};
    SYMBOLS.forEach(function (s) { COLORS[s[0]] = s[1]; });
    var grid = $('#memGrid'), movesEl = $('#memMoves'), timeEl = $('#memTime'), bestEl = $('#memBest'), msgEl = $('#memMsg');
    var game = null, buttons = [], tStart = 0, tTimer = null, mismatchTimer = null, elapsed = 0, best = bestGet('vc-mem-best');
    if (best != null) bestEl.textContent = best;

    function stopClock() { clearInterval(tTimer); tTimer = null; }
    function paintTime() { timeEl.textContent = Math.floor(elapsed) + 's'; }
    function startClock() {
      if (tTimer) return;
      tStart = Date.now() - elapsed * 1000;
      tTimer = setInterval(function () { elapsed = (Date.now() - tStart) / 1000; paintTime(); }, 250);
    }
    function paint() {
      game.cards.forEach(function (c, i) {
        var b = buttons[i];
        b.className = 'mcard' + (c.state === 'up' ? ' up' : c.state === 'matched' ? ' matched' : '');
        b.setAttribute('aria-label', c.state === 'down' ? (t('play.tabs.memory') + ' ' + (i + 1)) : c.value + (c.state === 'matched' ? ' ✓' : ''));
        b.disabled = c.state === 'matched';
      });
      movesEl.textContent = game.moves;
    }
    function build() {
      grid.textContent = '';
      buttons = game.cards.map(function (c, i) {
        var b = App.el('button', 'mcard');
        b.type = 'button';
        var inner = App.el('span', 'in');
        inner.appendChild(App.el('span', 'face back', '</>'));
        var front = App.el('span', 'face front', c.value);
        front.style.setProperty('--c', COLORS[c.value]);
        inner.appendChild(front);
        b.appendChild(inner);
        b.addEventListener('click', function () { onFlip(i); });
        grid.appendChild(b);
        return b;
      });
    }
    function onFlip(i) {
      var r = Memory.flip(game, i);
      if (!r.ok) return;
      startClock();
      paint();
      if (r.event === 'mismatch') {
        clearTimeout(mismatchTimer);
        mismatchTimer = setTimeout(function () { Memory.resolve(game); paint(); }, 850);
      }
      if (game.done) {
        stopClock();
        elapsed = (Date.now() - tStart) / 1000; paintTime();
        if (best == null || game.moves < best) { best = game.moves; App.store('vc-mem-best', String(best)); bestEl.textContent = best; }
        showDone();
      }
    }
    function showDone() {
      msgEl.textContent = t('play.memoryWin') + ' ' + game.moves + ' ' + t('play.moves').toLowerCase() + ' · ' + Math.floor(elapsed) + 's';
    }
    function reset() {
      clearTimeout(mismatchTimer); stopClock();
      elapsed = 0; paintTime();
      msgEl.textContent = '';
      game = Memory.create(SYMBOLS.map(function (s) { return s[0]; }));
      build(); paint();
    }
    $('#memReset').addEventListener('click', reset);
    pausers.push(stopClock); // clock freezes when the game is hidden/off-screen
    function resumeClock() { if (game && !game.done && game.moves + game.open.length > 0) startClock(); }
    reset();
    return {
      refreshText: function () { paint(); if (game.done) showDone(); },
      resumeClock: resumeClock,
    };
  })();

  /* ============================================================ LET IT CRASH */
  var crash = (function () {
    var N = 9;
    var wrap = $('#workers'), overlay = $('#crOverlay'), msg = $('#crMsg'), startBtn = $('#crStart');
    var livesEl = $('#crLives'), scoreEl = $('#crScore'), bestEl = $('#crBest');
    var game = null, mode = 'idle', raf = 0, last = 0, best = bestGet('vc-crash-best') || 0, nodes = [];
    bestEl.textContent = best;

    function build() {
      wrap.textContent = '';
      nodes = [];
      for (var i = 0; i < N; i++) {
        var b = App.el('button', 'worker');
        b.type = 'button';
        b.appendChild(App.el('kbd', null, String(i + 1)));
        b.appendChild(App.el('span', 'led'));
        b.appendChild(App.el('b', null, 'P' + (i + 1)));
        var st = App.el('small', null, t('play.running'));
        b.appendChild(st);
        var bar = App.el('span', 'bar');
        b.appendChild(bar);
        (function (idx) {
          b.addEventListener('click', function () { press(idx); });
        })(i);
        wrap.appendChild(b);
        nodes.push({ b: b, st: st, bar: bar, down: null });
      }
    }
    function hearts() {
      var h = '';
      for (var i = 0; i < 3; i++) h += i < (game ? game.lives : 3) ? '♥' : '♡';
      return h;
    }
    function paint() {
      if (!game) return;
      livesEl.textContent = hearts();
      scoreEl.textContent = game.restarts;
      game.workers.forEach(function (w, i) {
        var n = nodes[i];
        if (n.down !== w.crashed) {
          n.down = w.crashed;
          n.b.classList.toggle('crashed', w.crashed);
          n.st.textContent = t(w.crashed ? 'play.crashed' : 'play.running');
          n.b.setAttribute('aria-label', t('play.worker') + ' ' + (i + 1) + ': ' + t(w.crashed ? 'play.crashed' : 'play.running'));
        }
        n.bar.style.setProperty('--p', w.crashed ? Math.max(0, Math.min(1, 1 - w.timer / game.grace)).toFixed(3) : '0');
      });
    }
    function loop(now) {
      if (mode !== 'running') return;
      var dt = Math.min(50, now - last); // clamp: a stalled frame must not dump a huge step
      last = now;
      Crash.tick(game, dt);
      paint();
      if (game.over) return finish();
      raf = requestAnimationFrame(loop);
    }
    function finish() {
      mode = 'over';
      if (game.restarts > best) { best = game.restarts; App.store('vc-crash-best', String(best)); bestEl.textContent = best; }
      showEnd();
    }
    function showEnd() {
      setOverlay(overlay, msg, t('play.crashOver'), t('play.restarts') + ': ' + game.restarts);
      startBtn.textContent = t('play.again');
    }
    function start() {
      cancelAnimationFrame(raf);
      game = Crash.create(null, { workers: N });
      nodes.forEach(function (n) { n.down = null; });
      mode = 'running';
      overlay.hidden = true;
      paint();
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
    function pause() {
      if (mode !== 'running') return;
      cancelAnimationFrame(raf);
      mode = 'paused';
      setOverlay(overlay, msg, t('play.paused'));
      startBtn.textContent = t('play.resume');
    }
    function resume() {
      if (mode !== 'paused') return;
      mode = 'running';
      overlay.hidden = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
    function press(i) {
      if (mode !== 'running') return;
      if (Crash.restart(game, i)) paint();
    }
    pausers.push(pause);
    startBtn.addEventListener('click', function () { mode === 'paused' ? resume() : start(); });
    document.addEventListener('keydown', function (e) {
      if (mode !== 'running' || $('#panel-crash').hidden) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key >= '1' && e.key <= '9') { e.preventDefault(); press(parseInt(e.key, 10) - 1); }
    });

    function refreshText() {
      if (nodes.length) nodes.forEach(function (n) { n.down = null; });
      paint();
      if (mode === 'paused') { setOverlay(overlay, msg, t('play.paused')); startBtn.textContent = t('play.resume'); }
      else if (mode === 'over') showEnd();
      else if (mode === 'idle') { msg.textContent = t('play.crashIntro'); startBtn.textContent = t('play.start'); }
    }
    build();
    msg.textContent = t('play.crashIntro');
    livesEl.textContent = '♥♥♥';
    return { refreshText: refreshText };
  })();

  /* ============================================================ tabs + glue */
  var tabs = $$('#gameTabs [role=tab]');
  function select(name, focus) {
    tabs.forEach(function (tb) {
      var on = tb.getAttribute('data-game') === name;
      tb.setAttribute('aria-selected', on ? 'true' : 'false');
      tb.tabIndex = on ? 0 : -1;
      var panel = $('#' + tb.getAttribute('aria-controls'));
      if (panel) panel.hidden = !on;
      if (on && focus) tb.focus();
    });
    pausers.forEach(function (p) { p(); });
    if (name === 'memory') memory.resumeClock();
  }
  tabs.forEach(function (tb, i) {
    tb.addEventListener('click', function () { select(tb.getAttribute('data-game')); });
    tb.addEventListener('keydown', function (e) {
      var j = -1;
      if (e.key === 'ArrowRight') j = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = tabs.length - 1;
      if (j < 0) return;
      e.preventDefault();
      select(tabs[j].getAttribute('data-game'), true);
    });
  });

  // Never leave a game running in the background.
  var playVisible = false;
  function memoryPanelOpen() { return !$('#panel-memory').hidden; }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) pausers.forEach(function (p) { p(); });
    else if (playVisible && memoryPanelOpen()) memory.resumeClock();
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) {
      playVisible = en[0].isIntersecting;
      if (!playVisible) pausers.forEach(function (p) { p(); });
      else if (memoryPanelOpen()) memory.resumeClock();
    }, { threshold: 0.05 }).observe($('#play'));
  }

  window.addEventListener('langchange', function () {
    snake.refreshText(); memory.refreshText(); crash.refreshText();
  });

  window.Games = { select: select };
})();
