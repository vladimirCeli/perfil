/* Core UI: i18n, theme, navigation, hero effects, live GitHub data, background. */
(function () {
  'use strict';

  var root = document.documentElement;
  var REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SITE = window.SITE;

  /* If anything below fails, never leave content hidden by the reveal animation. */
  root.classList.add('js');
  setTimeout(function () { root.classList.add('reveal-all'); }, 3500);

  /* ------------------------------------------------------------ helpers */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function icon(id, cls) {
    var ns = 'http://www.w3.org/2000/svg';
    var s = document.createElementNS(ns, 'svg');
    s.setAttribute('class', 'ic' + (cls ? ' ' + cls : ''));
    s.setAttribute('aria-hidden', 'true');
    var u = document.createElementNS(ns, 'use');
    u.setAttribute('href', '#i-' + id);
    s.appendChild(u);
    return s;
  }
  function store(key, val) {
    try {
      if (val === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, val);
    } catch (e) { /* storage unavailable (private mode): ignore */ }
    return null;
  }
  function pathGet(obj, path) {
    return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj);
  }

  /* --------------------------------------------------------------- i18n */
  var lang = 'en';
  var saved = store('vc-lang');
  if (saved === 'es' || saved === 'en') lang = saved;
  else if ((navigator.language || '').toLowerCase().indexOf('es') === 0) lang = 'es';

  function t(key) {
    var v = pathGet(SITE.i18n[lang], key);
    if (v === undefined) v = pathGet(SITE.i18n.en, key);
    return v;
  }

  function applyStatic() {
    $$('[data-i18n]').forEach(function (n) {
      var v = t(n.getAttribute('data-i18n'));
      if (typeof v === 'string') n.textContent = v;
    });
    $$('[data-i18n-html]').forEach(function (n) {
      var v = t(n.getAttribute('data-i18n-html'));
      if (typeof v === 'string') n.innerHTML = v; // trusted, authored content only
    });
    $$('[data-i18n-attr]').forEach(function (n) {
      n.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
        var i = pair.indexOf(':');
        var v = t(pair.slice(i + 1));
        if (i > 0 && typeof v === 'string') n.setAttribute(pair.slice(0, i), v);
      });
    });
    root.setAttribute('lang', lang);
    document.title = t('meta.title');
    var md = $('meta[name="description"]');
    if (md) md.setAttribute('content', t('meta.description'));
    $('#langLabel').textContent = lang === 'en' ? 'ES' : 'EN';
    $('#cvBtn').setAttribute('href', SITE.links.cv[lang]);
  }

  function renderAbout() {
    var box = $('#aboutCards');
    box.textContent = '';
    t('about.cards').forEach(function (c, i) {
      var d = el('div', 'card reveal');
      d.style.transitionDelay = (i * 70) + 'ms';
      d.appendChild(icon(c.icon));
      d.appendChild(el('h3', null, c.t));
      d.appendChild(el('p', null, c.d));
      box.appendChild(d);
    });
  }

  function renderTimeline() {
    var ol = $('#timeline');
    ol.textContent = '';
    t('exp.items').forEach(function (j) {
      var li = el('li', 'job reveal' + (j.current ? ' current' : ''));
      var head = el('div', 'job-head');
      var h = el('h3');
      h.appendChild(document.createTextNode(j.role + ' · '));
      h.appendChild(el('span', null, j.org));
      if (j.current) h.appendChild(el('em', 'now', lang === 'es' ? 'actual' : 'current'));
      head.appendChild(h);
      head.appendChild(el('span', 'when', j.date));
      li.appendChild(head);
      li.appendChild(el('p', 'where', j.place));
      var ul = el('ul');
      j.bullets.forEach(function (b) { ul.appendChild(el('li', null, b)); });
      li.appendChild(ul);
      var chips = el('div', 'chips');
      j.stack.forEach(function (s) { chips.appendChild(el('span', 'chip', s)); });
      li.appendChild(chips);
      ol.appendChild(li);
    });
  }

  function renderProject() {
    var ul = $('#jobcelisPoints');
    ul.textContent = '';
    t('projects.jobcelisPoints').forEach(function (p) { ul.appendChild(el('li', null, p)); });
    var ol = $('#flow');
    ol.textContent = '';
    t('projects.flow').forEach(function (s) { ol.appendChild(el('li', null, s)); });
  }

  function renderSkills() {
    var g = $('#skillsGrid');
    g.textContent = '';
    SITE.skills.forEach(function (grp) {
      var box = el('div', 'skill-group reveal');
      box.appendChild(el('h3', null, t('skills.groups.' + grp.key)));
      var chips = el('div', 'chips');
      grp.items.forEach(function (i) { chips.appendChild(el('span', 'chip', i)); });
      box.appendChild(chips);
      g.appendChild(box);
    });
  }

  function externalLink(href, text, cls) {
    var a = el('a', cls || null);
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.appendChild(document.createTextNode(text));
    a.appendChild(icon('ext'));
    return a;
  }

  function renderCreds() {
    $('#pubTitle').textContent = '“' + t('pub.text') + '”';
    var ul = $('#certs');
    ul.textContent = '';
    SITE.certs.forEach(function (c) {
      var li = el('li');
      li.appendChild(el('span', 'n', c.name));
      li.appendChild(el('span', 'm', c.issuer + ' · ' + c.date + ' · ' + c.id));
      var a = externalLink(c.url, t('cred.verify'), 'v');
      a.setAttribute('aria-label', t('cred.verify') + ': ' + c.name + ' (' + t('ui.external') + ')');
      li.appendChild(a);
      ul.appendChild(li);
    });
    var edu = $('#edu');
    edu.textContent = '';
    t('cred.eduItems').forEach(function (e) {
      var li = el('li');
      li.appendChild(el('b', null, e.t));
      li.appendChild(el('span', 'o', e.o + ' · ' + e.d));
      var v = el('p', 'v', e.v);
      if (e.link) {
        v.appendChild(document.createTextNode(' '));
        v.appendChild(externalLink(SITE.links[e.link], e.linkText));
      }
      li.appendChild(v);
      edu.appendChild(li);
    });
  }

  function renderAll() {
    applyStatic();
    renderAbout();
    renderTimeline();
    renderProject();
    renderSkills();
    renderCreds();
    renderRepos();
    observeReveals();
    startTyped();
    var cb = $('#copyLabel');
    if (cb) cb.textContent = t('contact.copy');
  }

  function setLang(next) {
    if (next !== 'es' && next !== 'en') return false;
    lang = next;
    store('vc-lang', lang);
    renderAll();
    window.dispatchEvent(new CustomEvent('langchange', { detail: lang }));
    return true;
  }

  /* -------------------------------------------------------------- theme */
  function getTheme() { return root.getAttribute('data-theme') === 'light' ? 'light' : 'dark'; }
  function setTheme(next) {
    if (next !== 'light' && next !== 'dark') return false;
    root.setAttribute('data-theme', next);
    store('vc-theme', next);
    var m = $('meta[name="theme-color"]');
    if (m) m.setAttribute('content', next === 'light' ? '#f5f8ff' : '#050b18');
    window.dispatchEvent(new CustomEvent('themechange', { detail: next }));
    return true;
  }

  /* ---------------------------------------------------------- navigation */
  var header = $('.site-header');
  var burger = $('#burger');
  function closeMenu() { header.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); }
  burger.addEventListener('click', function () {
    var open = header.classList.toggle('open');
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  $$('#nav a').forEach(function (a) { a.addEventListener('click', closeMenu); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
  document.addEventListener('click', function (e) { if (!header.contains(e.target)) closeMenu(); });
  window.addEventListener('resize', function () { if (window.innerWidth >= 960) closeMenu(); });

  $('#langBtn').addEventListener('click', function () { setLang(lang === 'en' ? 'es' : 'en'); });
  $('#themeBtn').addEventListener('click', function () { setTheme(getTheme() === 'dark' ? 'light' : 'dark'); });

  // Active link highlighting
  var sections = $$('main section[id]');
  var navLinks = $$('#nav a');
  function updateActive() {
    var line = window.innerHeight * 0.4, cur = '';
    sections.forEach(function (s) {
      var r = s.getBoundingClientRect();
      if (r.top <= line && r.bottom > line) cur = s.id; // none while the hero is on screen
    });
    navLinks.forEach(function (a) { a.classList.toggle('active', a.getAttribute('href') === '#' + cur); });
  }

  // Back to top + active link (one throttled scroll handler)
  var toTop = $('#toTop');
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      toTop.classList.toggle('show', window.scrollY > 700);
      updateActive();
      ticking = false;
    });
  }, { passive: true });
  window.addEventListener('resize', updateActive);
  setTimeout(updateActive, 0);
  toTop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' }); });

  /* ------------------------------------------------------- reveal on scroll */
  var revealObs = null;
  function observeReveals() {
    var items = $$('.reveal:not(.in)');
    if (!('IntersectionObserver' in window)) { items.forEach(function (n) { n.classList.add('in'); }); return; }
    if (!revealObs) {
      revealObs = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('in'); revealObs.unobserve(en.target); }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    }
    items.forEach(function (n) { revealObs.observe(n); });
  }

  /* ----------------------------------------------------------- hero: typed */
  var typedTimer = null;
  function startTyped() {
    clearTimeout(typedTimer);
    var out = $('#typed');
    var roles = t('hero.roles');
    if (REDUCED) { out.textContent = roles[0]; return; }
    var ri = 0, ci = 0, deleting = false;
    (function tick() {
      var word = roles[ri];
      ci += deleting ? -1 : 1;
      out.textContent = word.slice(0, ci);
      var delay = deleting ? 28 : 62;
      if (!deleting && ci === word.length) { deleting = true; delay = 1700; }
      else if (deleting && ci === 0) { deleting = false; ri = (ri + 1) % roles.length; delay = 380; }
      typedTimer = setTimeout(tick, delay);
    })();
  }

  /* ----------------------------------------------------- hero: code window */
  var CODE = [
    [['k', 'defmodule'], ['', ' Portfolio '], ['k', 'do']],
    [['', '  '], ['k', 'use'], ['', ' Application']],
    [['c', '  # let it crash, then recover']],
    [['', '  '], ['k', 'def'], ['f', ' start'], ['', '(_type, _args) '], ['k', 'do']],
    [['', '    children = [']],
    [['', '      '], ['a', 'Delivery'], ['', ',']],
    [['', '      '], ['a', 'Retries'], ['', ',']],
    [['', '      '], ['a', 'Metrics']],
    [['', '    ]']],
    [['', '    Supervisor.'], ['f', 'start_link'], ['', '(children,']],
    [['', '      strategy: '], ['s', ':one_for_one'], ['', ',']],
    [['', '      max_restarts: '], ['a', '3']],
    [['', '    )']],
    [['', '  '], ['k', 'end']],
    [['k', 'end']],
  ];
  function renderCode(upto) {
    var pre = $('#code');
    pre.textContent = '';
    var left = upto;
    for (var li = 0; li < CODE.length && left > 0; li++) {
      CODE[li].forEach(function (seg) {
        if (left <= 0) return;
        var txt = seg[1].slice(0, left);
        left -= seg[1].length;
        if (!txt) return;
        if (seg[0]) pre.appendChild(el('span', seg[0], txt));
        else pre.appendChild(document.createTextNode(txt));
      });
      if (left > 0 || li < CODE.length - 1) { pre.appendChild(document.createTextNode('\n')); left -= 1; }
    }
  }
  var codeTotal = CODE.reduce(function (n, line) {
    return n + line.reduce(function (m, s) { return m + s[1].length; }, 0) + 1;
  }, 0);
  function startCode() {
    if (REDUCED) { renderCode(codeTotal); return; }
    var n = 0;
    var timer = setInterval(function () {
      n += 3;
      renderCode(n);
      if (n >= codeTotal) clearInterval(timer);
    }, 24);
  }

  /* --------------------------------------------------------- stats counters */
  var counted = false;
  function animateCount(node, target, prefix) {
    prefix = prefix || '';
    if (REDUCED) { node.textContent = prefix + target; return; }
    var start = performance.now(), dur = 1100;
    (function step(now) {
      var p = Math.min(1, (now - start) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      node.textContent = prefix + Math.round(target * eased);
      if (p < 1) requestAnimationFrame(step);
    })(start);
  }
  function runCounters() {
    if (counted) return;
    counted = true;
    $$('[data-count]').forEach(function (n) {
      if (n.id === 'repoCount') return; // filled by the GitHub fetch
      animateCount(n, parseInt(n.getAttribute('data-count'), 10), n.getAttribute('data-prefix'));
    });
    if (repoTotal != null) animateCount($('#repoCount'), repoTotal);
  }
  var statsBox = $('.stats');
  if ('IntersectionObserver' in window) {
    var so = new IntersectionObserver(function (en) {
      if (en[0].isIntersecting) { runCounters(); so.disconnect(); }
    }, { threshold: 0.4 });
    so.observe(statsBox);
  } else runCounters();

  /* ------------------------------------------------------ live GitHub data */
  var GH_USER = 'vladimirCeli';
  var GH_ORG = 'jobcelis-team';
  var LANG_COLORS = { Elixir: '#a78bfa', Erlang: '#e0556b', JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572a5', Java: '#b07219', HTML: '#e34c26', CSS: '#7c4dff', Vue: '#41b883', Dart: '#00b4ab', Shell: '#89e051', C: '#9aa0a6', 'C++': '#f34b7d', PHP: '#8892bf', Go: '#00add8', Rust: '#dea584', Kotlin: '#a97bff', Swift: '#f05138' };
  var repoState = { status: 'loading', repos: [] };
  var repoTotal = null;

  function fetchJSON(url, ms) {
    var ctl = ('AbortController' in window) ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, ms || 8000);
    return fetch(url, { headers: { Accept: 'application/vnd.github+json' }, signal: ctl ? ctl.signal : undefined })
      .then(function (r) {
        clearTimeout(timer);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .catch(function (e) { clearTimeout(timer); throw e; });
  }

  function loadRepos() {
    var CK = 'vc-gh-cache-v2';
    try {
      var c = JSON.parse(sessionStorage.getItem(CK) || 'null');
      if (c && Date.now() - c.t < 10 * 60 * 1000) { applyRepoData(c.user, c.repos); return; }
    } catch (e) { /* ignore corrupt cache */ }
    Promise.all([
      fetchJSON('https://api.github.com/users/' + GH_USER),
      fetchJSON('https://api.github.com/users/' + GH_USER + '/repos?per_page=100&sort=pushed'),
      fetchJSON('https://api.github.com/orgs/' + GH_ORG + '/repos?per_page=100&sort=pushed').catch(function () { return []; }),
    ]).then(function (res) {
      var repos = res[1].filter(function (r) { return r.stargazers_count > 0; }) // personal repos: only ones with stars
        .concat(res[2].filter(function (r) { return r.name !== '.github'; }));
      try { sessionStorage.setItem(CK, JSON.stringify({ t: Date.now(), user: res[0], repos: repos })); } catch (e) { /* quota */ }
      applyRepoData(res[0], repos);
    }).catch(function () {
      repoState = { status: 'error', repos: [] };
      renderRepos();
    });
  }

  function applyRepoData(user, repos) {
    repoTotal = typeof user.public_repos === 'number' ? user.public_repos : repos.length;
    var rc = $('#repoCount');
    rc.setAttribute('data-count', String(repoTotal));
    if (counted) animateCount(rc, repoTotal);
    var list = (Array.isArray(repos) ? repos : []).filter(function (r) { return !r.fork && !r.archived; });
    list.sort(function (a, b) {
      return (b.stargazers_count - a.stargazers_count) || (new Date(b.pushed_at) - new Date(a.pushed_at));
    });
    repoState = { status: list.length ? 'ok' : 'empty', repos: list.slice(0, 6) };
    renderRepos();
  }

  function renderRepos() {
    var box = $('#repos');
    box.textContent = '';
    if (repoState.status === 'loading') {
      for (var i = 0; i < 3; i++) box.appendChild(el('div', 'skeleton'));
      return;
    }
    if (repoState.status === 'error' || repoState.status === 'empty') {
      box.appendChild(el('p', 'muted', t(repoState.status === 'error' ? 'projects.error' : 'projects.empty')));
      return;
    }
    var fmt = new Intl.DateTimeFormat(lang === 'es' ? 'es-EC' : 'en-US', { month: 'short', year: 'numeric' });
    repoState.repos.forEach(function (r) {
      var a = el('a', 'repo');
      a.href = r.html_url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.appendChild(el('h4', null, r.full_name || r.name));
      a.appendChild(el('p', null, r.description || ''));
      var meta = el('div', 'repo-meta');
      if (r.language) {
        var l = el('span');
        var dot = el('span', 'lang-dot');
        dot.style.background = LANG_COLORS[r.language] || 'var(--accent)';
        l.appendChild(dot);
        l.appendChild(document.createTextNode(r.language));
        meta.appendChild(l);
      }
      var st = el('span');
      st.appendChild(icon('star'));
      st.appendChild(document.createTextNode(' ' + r.stargazers_count));
      meta.appendChild(st);
      if (r.pushed_at) meta.appendChild(el('span', null, t('projects.updated') + ' ' + fmt.format(new Date(r.pushed_at))));
      a.appendChild(meta);
      box.appendChild(a);
    });
  }

  /* --------------------------------------------------------------- contact */
  $('#copyBtn').addEventListener('click', function () {
    var addr = SITE.links.email;
    var label = $('#copyLabel');
    function done(ok) {
      label.textContent = t(ok ? 'contact.copied' : 'contact.copyFail');
      setTimeout(function () { label.textContent = t('contact.copy'); }, 1800);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(addr).then(function () { done(true); }, function () { done(fallbackCopy(addr)); });
    } else done(fallbackCopy(addr));
  });
  function fallbackCopy(text) {
    try {
      var ta = el('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }

  /* -------------------------------------------------------- background net */
  var bgCtl = (function background() {
    var cv = $('#bg');
    var ctx = cv.getContext && cv.getContext('2d');
    if (!ctx) return { start: function () {}, stop: function () {} };
    var w = 0, h = 0, nodes = [], mouse = { x: -999, y: -999 }, running = false, raf = 0, color = '79,141,255';

    function readColor() {
      var light = getTheme() === 'light';
      color = light ? '31,95,214' : '79,141,255';
    }
    function resize() {
      w = cv.width = window.innerWidth;
      h = cv.height = window.innerHeight;
      var count = Math.max(14, Math.min(46, Math.round((w * h) / 30000)));
      nodes = [];
      for (var i = 0; i < count; i++) {
        nodes.push({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - .5) * .28, vy: (Math.random() - .5) * .28 });
      }
      draw(false);
    }
    function draw(advance) {
      ctx.clearRect(0, 0, w, h);
      var i, j, a, b, dx, dy, d, max = 150;
      for (i = 0; i < nodes.length; i++) {
        a = nodes[i];
        if (advance) {
          a.x += a.vx; a.y += a.vy;
          if (a.x < 0 || a.x > w) a.vx *= -1;
          if (a.y < 0 || a.y > h) a.vy *= -1;
        }
        ctx.fillStyle = 'rgba(' + color + ',.55)';
        ctx.beginPath(); ctx.arc(a.x, a.y, 1.6, 0, 6.2832); ctx.fill();
        for (j = i + 1; j < nodes.length; j++) {
          b = nodes[j]; dx = a.x - b.x; dy = a.y - b.y; d = dx * dx + dy * dy;
          if (d < max * max) {
            ctx.strokeStyle = 'rgba(' + color + ',' + (0.16 * (1 - Math.sqrt(d) / max)).toFixed(3) + ')';
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
        dx = a.x - mouse.x; dy = a.y - mouse.y; d = dx * dx + dy * dy;
        if (d < 180 * 180) {
          ctx.strokeStyle = 'rgba(167,139,250,' + (0.28 * (1 - Math.sqrt(d) / 180)).toFixed(3) + ')';
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
        }
      }
    }
    function loop() { if (!running) return; draw(true); raf = requestAnimationFrame(loop); }
    function start() { if (REDUCED || running) return; running = true; raf = requestAnimationFrame(loop); }
    function stop() { running = false; cancelAnimationFrame(raf); }

    var rt;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(resize, 200); });
    window.addEventListener('pointermove', function (e) { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
    window.addEventListener('pointerleave', function () { mouse.x = mouse.y = -999; });
    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
    window.addEventListener('themechange', function () { readColor(); draw(false); });
    readColor(); resize(); start();
    return { start: function () { cv.style.display = ''; start(); }, stop: stop };
  })();


  /* ------------------------------------------------------------ 3D tilt cards */
  (function tilt() {
    if (REDUCED || !window.matchMedia || !matchMedia('(hover: hover)').matches) return;
    var SEL = '.card,.repo,.skill-group,.stat,.job';
    var cur = null, raf = 0, last = null;
    function leave() {
      if (!cur) return;
      var n = cur; cur = null;
      n.classList.remove('tilting');
      n.style.transition = 'transform .55s cubic-bezier(.2,.8,.2,1)';
      n.style.transform = '';
      setTimeout(function () { if (n !== cur) n.style.transition = ''; }, 580);
    }
    function apply() {
      raf = 0;
      if (!cur || !last) return;
      var r = cur.getBoundingClientRect();
      var px = Math.min(1, Math.max(0, (last.clientX - r.left) / r.width)), py = Math.min(1, Math.max(0, (last.clientY - r.top) / r.height));
      cur.style.transform = 'perspective(900px) translateY(-4px) rotateX(' + ((0.5 - py) * 9).toFixed(2) + 'deg) rotateY(' + ((px - 0.5) * 11).toFixed(2) + 'deg)';
      cur.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
      cur.style.setProperty('--my', (py * 100).toFixed(1) + '%');
    }
    document.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var el = e.target && e.target.closest ? e.target.closest(SEL) : null;
      if (el !== cur) {
        leave();
        if (el) { cur = el; el.classList.add('tilting'); el.style.transition = 'transform .12s ease-out'; }
      }
      last = e;
      if (cur && !raf) raf = requestAnimationFrame(apply);
    }, { passive: true });
    document.documentElement.addEventListener('mouseleave', leave);
    window.addEventListener('scroll', function () { if (cur) { leave(); } }, { passive: true });
  })();

  /* ------------------------------------------------------------------ boot */
  $('#year').textContent = new Date().getFullYear();
  renderAll();
  startCode();
  loadRepos();

  window.App = {
    t: t,
    lang: function () { return lang; },
    setLang: setLang,
    getTheme: getTheme,
    setTheme: setTheme,
    links: SITE.links,
    el: el,
    icon: icon,
    store: store,
    reduced: REDUCED,
    bg: bgCtl,
  };
})();
