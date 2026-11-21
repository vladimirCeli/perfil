'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Snake, Memory, Crash, shuffle } = require('../js/cores.js');

// Small deterministic PRNG (mulberry32) so tests are reproducible.
function prng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ Snake */
test('snake: starts alive, length 3, food off the snake', () => {
  const s = Snake.create(18, prng(1));
  assert.equal(s.snake.length, 3);
  assert.ok(s.alive && !s.won);
  assert.ok(!s.snake.some((p) => p.x === s.food.x && p.y === s.food.y));
});

test('snake: moves one cell per step and keeps its length', () => {
  const s = Snake.create(18, prng(2));
  s.food = { x: 0, y: 0 };
  const head = { ...s.snake[0] };
  Snake.step(s);
  assert.deepEqual(s.snake[0], { x: head.x + 1, y: head.y });
  assert.equal(s.snake.length, 3);
});

test('snake: reversal and duplicate turns are ignored', () => {
  const s = Snake.create(18, prng(3));
  assert.equal(Snake.turn(s, 'left'), false); // opposite of right
  assert.equal(Snake.turn(s, 'right'), false); // same direction
  assert.equal(Snake.turn(s, 'up'), true);
  assert.equal(Snake.turn(s, 'down'), false); // opposite of queued 'up'
  assert.equal(Snake.turn(s, 'left'), true); // legal after queued 'up'
  assert.equal(Snake.turn(s, 'down'), false); // queue capped at 2
});

test('snake: fast double turn cannot cause instant self-collision', () => {
  const s = Snake.create(18, prng(4));
  s.food = { x: 0, y: 0 };
  Snake.turn(s, 'up');
  Snake.turn(s, 'left'); // would be a 180 if applied in the same tick
  Snake.step(s);
  assert.ok(s.alive);
  Snake.step(s);
  assert.ok(s.alive);
});

test('snake: hitting a wall ends the game', () => {
  const s = Snake.create(5, prng(5));
  s.food = { x: 0, y: 0 };
  for (let i = 0; i < 10 && s.alive; i++) Snake.step(s);
  assert.equal(s.alive, false);
});

test('snake: eating grows by one and scores', () => {
  const s = Snake.create(18, prng(6));
  s.food = { x: s.snake[0].x + 1, y: s.snake[0].y };
  Snake.step(s);
  assert.equal(s.snake.length, 4);
  assert.equal(s.score, 1);
  assert.ok(!s.snake.some((p) => p.x === s.food.x && p.y === s.food.y));
});

test('snake: self collision ends the game', () => {
  const s = Snake.create(18, prng(7));
  s.snake = [
    { x: 5, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 4 }, { x: 5, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 5 }, { x: 4, y: 6 },
  ];
  s.dir = 'up';
  s.food = { x: 0, y: 0 };
  Snake.step(s); // head (5,4) is body
  assert.equal(s.alive, false);
});

test('snake: moving into the cell the tail just left is legal', () => {
  const s = Snake.create(18, prng(8));
  // 2x2 loop: head chasing its own tail
  s.snake = [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 6, y: 5 }];
  s.dir = 'right'; // head goes to (6,5) which is the tail cell
  s.food = { x: 0, y: 0 };
  Snake.step(s);
  assert.ok(s.alive);
});

test('snake: filling the board wins', () => {
  const s = Snake.create(3, prng(9));
  s.snake = [
    { x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 1, y: 2 }, { x: 0, y: 2 },
  ];
  s.dir = 'right';
  s.food = { x: 1, y: 1 }; // the only free cell
  Snake.step(s);
  assert.equal(s.won, true);
  assert.equal(s.alive, false);
  assert.equal(s.food, null);
});

test('snake: food always lands on a free cell (fuzz)', () => {
  const rng = prng(10);
  for (let n = 0; n < 200; n++) {
    const s = Snake.create(8, rng);
    for (let i = 0; i < 40 && s.alive; i++) {
      if (rng() < 0.3) Snake.turn(s, ['up', 'down', 'left', 'right'][Math.floor(rng() * 4)]);
      Snake.step(s);
      if (s.food) assert.ok(!s.snake.some((p) => p.x === s.food.x && p.y === s.food.y));
      assert.equal(new Set(s.snake.map((p) => p.x + ',' + p.y)).size, s.snake.length);
    }
  }
});

test('snake: delay speeds up but never below the floor', () => {
  assert.ok(Snake.delay(0) > Snake.delay(10));
  assert.equal(Snake.delay(500), 70);
});

/* ----------------------------------------------------------------- Memory */
test('memory: shuffle is a permutation and does not mutate the input', () => {
  const a = [1, 2, 3, 4, 5, 6, 7, 8];
  const b = shuffle(a, prng(11));
  assert.deepEqual(a, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(b.slice().sort(), a);
});

test('memory: board has each symbol exactly twice', () => {
  const m = Memory.create(['A', 'B', 'C', 'D'], prng(12));
  assert.equal(m.cards.length, 8);
  ['A', 'B', 'C', 'D'].forEach((v) => assert.equal(m.cards.filter((c) => c.value === v).length, 2));
});

function pairIndexes(m) {
  const seen = {};
  const pairs = [];
  m.cards.forEach((c, i) => {
    if (seen[c.value] === undefined) seen[c.value] = i;
    else pairs.push([seen[c.value], i]);
  });
  return pairs;
}

test('memory: a match keeps both cards face up and counts one move', () => {
  const m = Memory.create(['A', 'B'], prng(13));
  const [a, b] = pairIndexes(m)[0];
  assert.equal(Memory.flip(m, a).event, 'first');
  assert.equal(Memory.flip(m, b).event, 'match');
  assert.equal(m.moves, 1);
  assert.equal(m.cards[a].state, 'matched');
  assert.equal(m.open.length, 0);
});

test('memory: a mismatch locks the board until resolved', () => {
  const m = Memory.create(['A', 'B'], prng(14));
  const [p1, p2] = pairIndexes(m);
  assert.equal(Memory.flip(m, p1[0]).event, 'first');
  assert.equal(Memory.flip(m, p2[0]).event, 'mismatch');
  assert.equal(m.locked, true);
  const other = m.cards.findIndex((c) => c.state === 'down');
  assert.equal(Memory.flip(m, other).ok, false); // locked
  assert.equal(Memory.resolve(m), true);
  assert.ok(m.cards.every((c) => c.state === 'down'));
  assert.equal(Memory.flip(m, other).ok, true);
});

test('memory: flipping the same card twice or a matched card is ignored', () => {
  const m = Memory.create(['A', 'B'], prng(15));
  const [a, b] = pairIndexes(m)[0];
  Memory.flip(m, a);
  assert.equal(Memory.flip(m, a).ok, false);
  Memory.flip(m, b);
  assert.equal(Memory.flip(m, a).ok, false);
  assert.equal(Memory.flip(m, 99).ok, false);
});

test('memory: solving every pair finishes the game', () => {
  const m = Memory.create(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], prng(16));
  pairIndexes(m).forEach(([a, b]) => { Memory.flip(m, a); Memory.flip(m, b); });
  assert.equal(m.done, true);
  assert.equal(m.moves, 8);
  assert.equal(Memory.flip(m, 0).ok, false);
});

/* ------------------------------------------------------------ Let it crash */
test('crash: nothing is down at the start', () => {
  const g = Crash.create(prng(20));
  assert.equal(g.lives, 3);
  assert.ok(g.workers.every((w) => !w.crashed));
});

test('crash: workers eventually crash', () => {
  const g = Crash.create(prng(21));
  Crash.tick(g, 1000);
  assert.ok(g.workers.some((w) => w.crashed));
});

test('crash: restarting a crashed worker scores; restarting a healthy one does not', () => {
  const g = Crash.create(prng(22));
  Crash.tick(g, 1000);
  const down = g.workers.findIndex((w) => w.crashed);
  const up = g.workers.findIndex((w) => !w.crashed);
  assert.equal(Crash.restart(g, up), false);
  assert.equal(Crash.restart(g, down), true);
  assert.equal(g.restarts, 1);
  assert.equal(Crash.restart(g, down), false);
});

test('crash: ignoring crashes costs lives and ends the game', () => {
  const g = Crash.create(prng(23));
  for (let i = 0; i < 4000 && !g.over; i++) Crash.tick(g, 16);
  assert.equal(g.over, true);
  assert.equal(g.lives, 0);
  const before = g.t;
  Crash.tick(g, 1000);
  assert.equal(g.t, before); // frozen after game over
  assert.equal(Crash.restart(g, 0), false);
});

test('crash: a player who restarts promptly survives', () => {
  const g = Crash.create(prng(24));
  for (let i = 0; i < 4000; i++) {
    Crash.tick(g, 16);
    g.workers.forEach((w, idx) => { if (w.crashed && w.timer < g.grace - 500) Crash.restart(g, idx); });
  }
  assert.equal(g.over, false);
  assert.ok(g.restarts > 20);
});

test('crash: never more crashed workers than workers, interval has a floor', () => {
  const g = Crash.create(prng(25), { workers: 4 });
  for (let i = 0; i < 2000 && !g.over; i++) {
    Crash.tick(g, 50);
    assert.ok(g.workers.filter((w) => w.crashed).length <= 4);
  }
  assert.equal(Crash.interval(10 ** 7), 420);
});

test('crash: identical seeds give identical games (deterministic)', () => {
  const run = () => {
    const g = Crash.create(prng(26));
    const log = [];
    for (let i = 0; i < 300; i++) { Crash.tick(g, 33); log.push(g.workers.map((w) => +w.crashed).join('')); }
    return log.join('|');
  };
  assert.equal(run(), run());
});
