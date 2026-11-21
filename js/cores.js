/*
 * Game logic cores: pure, deterministic (rng and time are injected) and
 * free of DOM access, so they can be unit-tested with Node (see /tests).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Cores = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------------------------------------------------------------- Snake */
  const DIRS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };
  const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

  const Snake = {
    DIRS,
    create(size, rng) {
      rng = rng || Math.random;
      const mid = Math.floor(size / 2);
      const s = {
        size,
        rng,
        snake: [{ x: mid, y: mid }, { x: mid - 1, y: mid }, { x: mid - 2, y: mid }],
        dir: 'right',
        queue: [],
        food: null,
        score: 0,
        alive: true,
        won: false,
      };
      s.food = Snake.placeFood(s);
      return s;
    },
    placeFood(s) {
      const taken = new Set(s.snake.map((p) => p.x + ',' + p.y));
      const free = [];
      for (let y = 0; y < s.size; y++) {
        for (let x = 0; x < s.size; x++) {
          if (!taken.has(x + ',' + y)) free.push({ x, y });
        }
      }
      if (!free.length) return null;
      return free[Math.min(free.length - 1, Math.floor(s.rng() * free.length))];
    },
    /** Queue a direction change. Ignores reversals and duplicates (no instant self-collision). */
    turn(s, dir) {
      if (!DIRS[dir] || !s.alive) return false;
      const last = s.queue.length ? s.queue[s.queue.length - 1] : s.dir;
      if (dir === last || dir === OPPOSITE[last]) return false;
      if (s.queue.length >= 2) return false;
      s.queue.push(dir);
      return true;
    },
    step(s) {
      if (!s.alive) return s;
      if (s.queue.length) s.dir = s.queue.shift();
      const d = DIRS[s.dir];
      const head = { x: s.snake[0].x + d.x, y: s.snake[0].y + d.y };
      if (head.x < 0 || head.y < 0 || head.x >= s.size || head.y >= s.size) {
        s.alive = false;
        return s;
      }
      const eating = !!s.food && head.x === s.food.x && head.y === s.food.y;
      // The tail cell is freed this tick unless we grow, so moving into it is legal.
      const body = eating ? s.snake : s.snake.slice(0, -1);
      if (body.some((p) => p.x === head.x && p.y === head.y)) {
        s.alive = false;
        return s;
      }
      s.snake.unshift(head);
      if (eating) {
        s.score += 1;
        s.food = Snake.placeFood(s);
        if (!s.food) {
          s.won = true;
          s.alive = false;
        }
      } else {
        s.snake.pop();
      }
      return s;
    },
    /** Tick delay in ms: starts relaxed and speeds up, with a floor. */
    delay(score) {
      return Math.max(70, 150 - score * 4);
    },
  };

  /* --------------------------------------------------------------- Memory */
  function shuffle(arr, rng) {
    rng = rng || Math.random;
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.min(i, Math.floor(rng() * (i + 1)));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const Memory = {
    shuffle,
    create(symbols, rng) {
      const cards = shuffle(symbols.concat(symbols), rng).map((v, i) => ({ id: i, value: v, state: 'down' }));
      return { cards, open: [], moves: 0, matched: 0, pairs: symbols.length, locked: false, done: false };
    },
    /**
     * Flip card i. Returns { ok, event } where event is one of:
     * 'first' | 'match' | 'mismatch' | null. After a 'mismatch' the board is
     * locked until Memory.resolve() is called (the UI calls it after a delay).
     */
    flip(m, i) {
      const c = m.cards[i];
      if (!c || m.locked || m.done || c.state !== 'down') return { ok: false, event: null };
      c.state = 'up';
      m.open.push(i);
      if (m.open.length === 1) return { ok: true, event: 'first' };
      m.moves += 1;
      const [a, b] = m.open;
      if (m.cards[a].value === m.cards[b].value) {
        m.cards[a].state = m.cards[b].state = 'matched';
        m.open = [];
        m.matched += 1;
        if (m.matched === m.pairs) m.done = true;
        return { ok: true, event: 'match' };
      }
      m.locked = true;
      return { ok: true, event: 'mismatch' };
    },
    resolve(m) {
      if (!m.locked) return false;
      m.open.forEach((i) => (m.cards[i].state = 'down'));
      m.open = [];
      m.locked = false;
      return true;
    },
  };

  /* ---------------------------------------------------- "Let it crash" game */
  /*
   * A supervisor with N workers. Workers crash at random; restart a crashed
   * worker before its grace period expires or the supervisor loses a life.
   * (An Erlang supervisor gives up after too many failures: max_restarts.)
   */
  const Crash = {
    create(rng, opts) {
      opts = opts || {};
      return {
        rng: rng || Math.random,
        n: opts.workers || 9,
        lives: opts.lives || 3,
        grace: opts.grace || 2600, // ms a crashed worker can stay down
        workers: Array.from({ length: opts.workers || 9 }, () => ({ crashed: false, timer: 0 })),
        t: 0, // elapsed ms
        nextCrashIn: 900,
        restarts: 0,
        over: false,
        lost: 0,
      };
    },
    /** Time between crashes shrinks with elapsed time, with a floor. */
    interval(t) {
      return Math.max(420, 1250 - t * 0.012);
    },
    /** Advance by dt ms (callers clamp dt so a hidden tab can't dump a huge step). */
    tick(g, dt) {
      if (g.over) return g;
      g.t += dt;
      g.nextCrashIn -= dt;
      while (g.nextCrashIn <= 0) {
        const alive = [];
        g.workers.forEach((w, i) => { if (!w.crashed) alive.push(i); });
        if (alive.length) {
          const i = alive[Math.min(alive.length - 1, Math.floor(g.rng() * alive.length))];
          g.workers[i].crashed = true;
          g.workers[i].timer = g.grace;
        }
        g.nextCrashIn += Crash.interval(g.t);
      }
      g.workers.forEach((w) => {
        if (!w.crashed) return;
        w.timer -= dt;
        if (w.timer <= 0) {
          // The failure escalated: the supervisor pays and the worker is replaced.
          w.crashed = false;
          w.timer = 0;
          g.lives -= 1;
          g.lost += 1;
        }
      });
      if (g.lives <= 0) {
        g.lives = 0;
        g.over = true;
      }
      return g;
    },
    restart(g, i) {
      const w = g.workers[i];
      if (g.over || !w || !w.crashed) return false;
      w.crashed = false;
      w.timer = 0;
      g.restarts += 1;
      return true;
    },
  };

  return { Snake, Memory, Crash, shuffle };
});
