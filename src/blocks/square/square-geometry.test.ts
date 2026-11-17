import { describe, expect, it } from 'vitest';

import { toSquareModelPoint } from './square-geometry.js';

describe('toSquareModelPoint', () => {
  it('leaves coordinates unchanged when the figure is not rotated', () => {
    expect(toSquareModelPoint({ x: 20, y: 70 }, 0)).toEqual({
      x: 20,
      y: 70,
    });
  });

  it('reverses the visual rotation before storing model coordinates', () => {
    // Model point (50, 60) appears at (40, 50) after a 90-degree SVG rotation.
    expect(toSquareModelPoint({ x: 40, y: 50 }, 90).x).toBeCloseTo(50);
    expect(toSquareModelPoint({ x: 40, y: 50 }, 90).y).toBeCloseTo(60);
  });

  it('supports arbitrary rotation angles', () => {
    const original = { x: 72, y: 31 };
    const angle = 37;
    const radians = (angle * Math.PI) / 180;
    const dx = original.x - 50;
    const dy = original.y - 50;
    const displayed = {
      x: Math.cos(radians) * dx - Math.sin(radians) * dy + 50,
      y: Math.sin(radians) * dx + Math.cos(radians) * dy + 50,
    };

    const result = toSquareModelPoint(displayed, angle);
    expect(result.x).toBeCloseTo(original.x);
    expect(result.y).toBeCloseTo(original.y);
  });

  it('clamps points to the editable interior', () => {
    expect(toSquareModelPoint({ x: -20, y: 150 }, 0)).toEqual({
      x: 1,
      y: 99,
    });
  });
});
