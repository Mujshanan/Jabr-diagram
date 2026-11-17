export type SquarePoint = { x: number; y: number };

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/**
 * Convert an SVG point (after the square's visual rotation) back into the
 * square's unrotated 0..100 model coordinates.
 */
export function toSquareModelPoint(
  point: SquarePoint,
  rotationDegrees: number
): SquarePoint {
  const radians = (rotationDegrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = point.x - 50;
  const dy = point.y - 50;

  return {
    x: clamp(cos * dx + sin * dy + 50, 1, 99),
    y: clamp(-sin * dx + cos * dy + 50, 1, 99),
  };
}
