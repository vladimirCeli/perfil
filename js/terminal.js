/* Interactive terminal. User input is only ever written with textContent (never innerHTML). */
(function () {
  'use strict';

  var App = window.App;
  var t = App.t;
  var out = document.getElementById('termOut');
  var form = document.getElementById('termForm');
  var input = document.getElementById('termInput');
  var box = document.getElementById('term');
  var MAX_LINES = 250;
  var history = [], hIndex = 0;

  var COMMANDS = ['help', 'about', 'skills', 'experience', 'projects', 'certs', 'contact', 'cv', 'play', 'lang', 'theme', 'clear', 'whoami', 'ls', 'hello', 'sudo'];

  function line(text, cls) {
    var d = App.el('div', 'ln' + (cls ? ' ' + cls : ''), text);
    out.appendChild(d);
    trim();
    return d;
  }
  function linkLine(prefix, href, label) {
    var d = App.el('div', 'ln');
    if (prefix) d.appendChild(document.createTextNode(prefix));
    var a = App.el('a', null, label || href);
    a.href = href;
    if (/^https?:/i.test(href)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    d.appendChild(a);
    out.appendChild(d);
    trim();
  }
  function trim() {
    while (out.childNodes.length > MAX_LINES) out.removeChild(out.firstChild);
  }
  function toBottom() { out.scrollTop = out.scrollHeight; }
  function pad(s, n) { while (s.length < n) s += ' '; return s; }

  var handlers = {
    help: function () {
      t('term.help').forEach(function (r) {
        var d = App.el('div', 'ln');
        d.appendChild(App.el('span', 'hl', '  ' + pad(r[0], 28)));
        d.appendChild(document.createTextNode(r[1]));
        out.appendChild(d);
      });
    },
    about: function () { line(t('term.about')); },
    skills: function () { line(t('term.skillsOut')); },
    experience: function () { t('term.experienceOut').forEach(function (l) { line(l); }); },
    projects: function () {
      linkLine(t('term.projectsOut')[0].split(': ')[0] + ': ', App.links.jobcelis, 'jobcelis.com');
      linkLine(t('term.projectsOut')[1].split(': ')[0] + ': ', App.links.github, 'github.com/vladimirCeli');
    },
    certs: function () {
      line(t('term.certsOut'));
      window.SITE.certs.forEach(function (c) { linkLine('  ' + c.name + ' — ', c.url, t('cred.verify')); });
    },
    contact: function () {
      linkLine(t('term.contactOut'), 'mailto:' + App.links.email, App.links.email);
      linkLine('LinkedIn: ', App.links.linkedin, 'linkedin.com/in/vladimir-celi-b8a237186');
      linkLine('GitHub:   ', App.links.github, 'github.com/vladimirCeli');
    },
    cv: function () {
      var href = App.links.cv[App.lang()];
      line(t('term.cvOut'), 'dim');
      linkLine('→ ', href, href);
      window.open(href, '_blank', 'noopener');
    },
    play: function (args) {
      var g = (args[0] || '').toLowerCase();
      if (['snake', 'memory', 'crash'].indexOf(g) < 0) { line(t('term.usage') + 'play <snake|memory|crash>', 'err'); return; }
      window.Games.select(g);
      var sec = document.getElementById('play');
      sec.scrollIntoView({ behavior: App.reduced ? 'auto' : 'smooth', block: 'start' });
    },
    lang: function (args) {
      var l = (args[0] || '').toLowerCase();
      if (l !== 'es' && l !== 'en') { line(t('term.usage') + 'lang <es|en>', 'err'); return; }
      App.setLang(l);
      line(t('term.langOk'), 'dim');
    },
    theme: function (args) {
      var m = (args[0] || '').toLowerCase();
      if (m !== 'dark' && m !== 'light') { line(t('term.usage') + 'theme <dark|light>', 'err'); return; }
      App.setTheme(m);
      line(t('term.themeOk'), 'dim');
    },
    clear: function () { out.textContent = ''; },
    whoami: function () { line(t('term.whoami')); },
    ls: function () { line(t('term.ls')); },
    hello: function () { line(t('term.hello')); },
    sudo: function () { line(t('term.sudo'), 'err'); },
  };
  handlers.hi = handlers.hello;

  function run(raw) {
    var text = raw.trim();
    var echo = App.el('div', 'ln');
    echo.appendChild(App.el('span', 'cmd', '$ '));
    echo.appendChild(document.createTextNode(raw));
    out.appendChild(echo);
    if (!text) { toBottom(); return; }
    var parts = text.split(/\s+/);
    var name = parts[0].toLowerCase();
    var fn = Object.prototype.hasOwnProperty.call(handlers, name) ? handlers[name] : null;
    if (fn) {
      try { fn(parts.slice(1)); } catch (e) { line(String(e && e.message || e), 'err'); }
    } else {
      line(t('term.unknown') + name, 'err');
    }
    toBottom();
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = input.value;
    if (v.trim() && history[history.length - 1] !== v) history.push(v);
    if (history.length > 50) history.shift();
    hIndex = history.length;
    input.value = '';
    run(v);
  });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowUp') {
      if (!history.length) return;
      e.preventDefault();
      hIndex = Math.max(0, hIndex - 1);
      input.value = history[hIndex];
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      hIndex = Math.min(history.length, hIndex + 1);
      input.value = hIndex === history.length ? '' : history[hIndex];
    } else if (e.key === 'Tab') {
      var v = input.value;
      if (!v || /\s/.test(v)) return; // only complete the command word
      e.preventDefault();
      var m = COMMANDS.filter(function (c) { return c.indexOf(v.toLowerCase()) === 0; });
      if (m.length === 1) input.value = m[0] + ' ';
      else if (m.length > 1) { line('$ ' + v, 'dim'); line(m.join('  ')); toBottom(); }
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === 'L')) {
      e.preventDefault();
      out.textContent = '';
    }
  });

  // Clicking anywhere on the terminal focuses the prompt (unless the user is selecting text or following a link).
  box.addEventListener('click', function (e) {
    if (e.target.closest('a')) return;
    var sel = window.getSelection && window.getSelection();
    if (sel && String(sel).length) return;
    input.focus({ preventScroll: true });
  });

  line(t('term.welcome'), 'dim');
})();
