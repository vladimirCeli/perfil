# Vladimir Celi · portfolio

Live site: https://vladimirceli.github.io/perfil/

A hand-built, bilingual (ES/EN) portfolio with a 3D hero scene (three.js, vendored in `js/vendor`) and no trackers.

- **3D:** a self-healing process network around the portrait (`js/scene3d.js`), an interactive skills sphere (`js/tagsphere.js`) and 3D tilt cards. Falls back to a 2D background without WebGL. Add `?nogl` to the URL to force the fallback.
- **Live data:** public repos come from the GitHub API (Jobcelis organization first), cached for 10 minutes per session.
- **Games:** Snake, Memory and "Let it crash" (an Erlang-style supervisor game). All rules live in `js/cores.js` and are unit-tested.
- **Terminal:** type `help` in the terminal section.
- **Accessibility:** keyboard navigable, skip link, ARIA tabs, and light/dark themes.
- **Credentials:** every certificate and degree links to its public verification page.

## Structure

```
index.html        page skeleton
css/style.css     base styles (mobile-first, CSS variables for themes)
css/v2.css        organic shapes, waves, 3D and glass overrides
js/content.js     all text (ES/EN), links, certificates, skills
js/main.js        i18n, theme, navigation, hero, GitHub data, tilt, 2D fallback background
js/scene3d.js     WebGL hero scene (ES module)
js/tagsphere.js   interactive 3D skills cloud
js/vendor/        three.js r160 (MIT)
js/cores.js       pure game logic (no DOM)
js/games.js       game UIs
js/terminal.js    interactive terminal
cv/               CV in Spanish and English (PDF)
tests/            unit tests for the game logic
```

## Develop

```bash
python -m http.server 8000     # then open http://localhost:8000
node --test tests/cores.test.js
```

Bump the `?v=` query string on the CSS/JS references in `index.html` after changing assets so visitors don't get stale caches.
