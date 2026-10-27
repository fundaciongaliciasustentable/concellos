import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { beeswarm, fitGeo, position, valueScale } from '../js/layout.js';

describe('retrato layout', () => {
  it('fits Galicia into a box, north up and inside', () => {
    const pts = [
      [-9.3, 42.9],
      [-6.8, 42.4],
      [-8.0, 43.7],
      [-7.9, 41.9],
    ];
    const box = { x: 10, y: 20, width: 300, height: 400 };
    const p = fitGeo(pts, box);
    for (const [lon, lat] of pts) {
      const { x, y } = p(lon, lat);
      assert.ok(x >= box.x - 1e-9);
      assert.ok(x <= box.x + box.width + 1e-9);
      assert.ok(y >= box.y - 1e-9);
      assert.ok(y <= box.y + box.height + 1e-9);
    }
    assert.ok(p(-8, 43.7).y < p(-7.9, 41.9).y);
  });

  it('picks log, square-root or linear scales from the spread', () => {
    assert.equal(valueScale([1, 2, 3], 0, 100).kind, 'linear');
    assert.equal(valueScale([-5, 10], 0, 100).kind, 'linear');
    const log = valueScale([1, 10, 100], 0, 100);
    assert.equal(log.kind, 'log');
    assert.ok(Math.abs(log(10) - 50) < 1e-6);
    const sqrt = valueScale([0, 1, 1, 2, 100], 0, 100);
    assert.equal(sqrt.kind, 'sqrt');
    assert.ok(Math.abs(sqrt(25) - 50) < 1e-6);
  });

  it('places beeswarm dots without overlaps', () => {
    const xs = Array.from({ length: 200 }, (_, i) => (i * 7919) % 97);
    const r = 3;
    const ys = beeswarm(xs, r);
    for (let i = 0; i < xs.length; i++) {
      for (let j = i + 1; j < xs.length; j++) {
        const d2 =
          ((xs[i]) - (xs[j])) ** 2 +
          ((ys[i]) - (ys[j])) ** 2;
        assert.ok(d2 >= 4 * r * r - 1e-6);
      }
    }
    // An isolated dot stays on the centre line.
    assert.deepEqual(beeswarm([0, 100], 3), [0, 0]);
  });

  it('describes position neutrally', () => {
    const vs = [1, 2, 3, 4, 5];
    assert.deepEqual(position(5, vs), { side: 'above', pct: 100 });
    assert.deepEqual(position(1, vs), { side: 'below', pct: 100 });
    assert.deepEqual(position(3, vs), { side: 'middle', pct: 50 });
    assert.deepEqual(position(4, vs), { side: 'above', pct: 75 });
  });
});
