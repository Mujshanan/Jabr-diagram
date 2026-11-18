export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };
export type Transform = {
  translateX: number;
  translateY: number;
  rotationDegrees: number;
  scaleX: number;
  scaleY: number;
};
export type DiagramStyle = {
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
  opacity?: number;
};
type ElementBase = {
  id: string;
  /** Namespaced, JSON-safe adapter metadata; renderers must ignore unknown keys. */
  extensions?: Record<string, unknown>;
  transform?: Transform;
  style?: DiagramStyle;
};
export type LineElement = ElementBase & { kind: 'line'; points: [Point, Point] };
export type PolylineElement = ElementBase & {
  kind: 'polyline';
  points: Point[];
  closed?: boolean;
};
export type RectangleElement = ElementBase & { kind: 'rectangle'; bounds: Rect };
export type EllipseElement = ElementBase & { kind: 'ellipse'; bounds: Rect };
export type TextElement = ElementBase & { kind: 'text'; bounds: Rect; text: string };
export type DiagramElement =
  | LineElement
  | PolylineElement
  | RectangleElement
  | EllipseElement
  | TextElement;
export type DiagramDocument = {
  schemaVersion: 1;
  id: string;
  coordinateSystem: { unit: string; origin: 'top-left'; yAxis: 'down' };
  /** Array order is the authored z-order. */
  elements: DiagramElement[];
};
export type DiagramValidationIssue = { path: string; code: string; message: string };

export const IDENTITY_TRANSFORM: Readonly<Transform> = Object.freeze({
  translateX: 0, translateY: 0, rotationDegrees: 0, scaleX: 1, scaleY: 1,
});

const finite = (n: number) => Number.isFinite(n);
const validPoint = (p: Point) => finite(p.x) && finite(p.y);
const validRect = (r: Rect) =>
  finite(r.x) && finite(r.y) && finite(r.width) && finite(r.height) &&
  r.width >= 0 && r.height >= 0;

export function validateDiagramDocument(document: DiagramDocument): DiagramValidationIssue[] {
  const issues: DiagramValidationIssue[] = [];
  if (document.schemaVersion !== 1)
    issues.push({ path: 'schemaVersion', code: 'unsupported-version', message: 'Only schema version 1 is supported.' });
  if (!document.id.trim())
    issues.push({ path: 'id', code: 'required', message: 'Document ID must not be empty.' });
  if (!document.coordinateSystem.unit.trim())
    issues.push({ path: 'coordinateSystem.unit', code: 'required', message: 'A document unit is required.' });
  if (document.coordinateSystem.origin !== 'top-left' || document.coordinateSystem.yAxis !== 'down')
    issues.push({ path: 'coordinateSystem', code: 'unsupported-coordinate-system', message: 'V1 requires top-left origin and positive Y downward.' });

  const ids = new Set<string>();
  document.elements.forEach((element, index) => {
    const path = `elements[${index}]`;
    if (!element.id.trim())
      issues.push({ path: `${path}.id`, code: 'required', message: 'Element ID must not be empty.' });
    else if (ids.has(element.id))
      issues.push({ path: `${path}.id`, code: 'duplicate-id', message: 'Element IDs must be unique within a document.' });
    ids.add(element.id);

    if (element.transform) {
      const t = element.transform;
      if (![t.translateX, t.translateY, t.rotationDegrees, t.scaleX, t.scaleY].every(finite) || t.scaleX === 0 || t.scaleY === 0)
        issues.push({ path: `${path}.transform`, code: 'invalid-transform', message: 'Transform values must be finite and scale components non-zero.' });
    }
    if (element.style) {
      const s = element.style;
      if (s.strokeWidth !== undefined && (!finite(s.strokeWidth) || s.strokeWidth < 0))
        issues.push({ path: `${path}.style.strokeWidth`, code: 'invalid-stroke-width', message: 'Stroke width must be finite and non-negative.' });
      if (s.opacity !== undefined && (!finite(s.opacity) || s.opacity < 0 || s.opacity > 1))
        issues.push({ path: `${path}.style.opacity`, code: 'invalid-opacity', message: 'Opacity must be between 0 and 1.' });
    }
    if (element.kind === 'line' && !element.points.every(validPoint))
      issues.push({ path: `${path}.points`, code: 'invalid-point', message: 'Line coordinates must be finite.' });
    if (element.kind === 'polyline') {
      if (element.points.length < 2)
        issues.push({ path: `${path}.points`, code: 'too-few-points', message: 'A polyline requires at least two points.' });
      if (!element.points.every(validPoint))
        issues.push({ path: `${path}.points`, code: 'invalid-point', message: 'Polyline coordinates must be finite.' });
    }
    if ((element.kind === 'rectangle' || element.kind === 'ellipse' || element.kind === 'text') && !validRect(element.bounds))
      issues.push({ path: `${path}.bounds`, code: 'invalid-bounds', message: 'Bounds must be finite and dimensions non-negative.' });
    if (element.kind === 'text' && typeof element.text !== 'string')
      issues.push({ path: `${path}.text`, code: 'invalid-text', message: 'Text content must be a string.' });
  });
  return issues;
}

export function transformPoint(point: Point, transform: Transform = IDENTITY_TRANSFORM): Point {
  const x = point.x * transform.scaleX;
  const y = point.y * transform.scaleY;
  const radians = transform.rotationDegrees * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: x * cos - y * sin + transform.translateX,
    y: x * sin + y * cos + transform.translateY,
  };
}

function localBounds(element: DiagramElement): Rect {
  if (element.kind === 'line' || element.kind === 'polyline') {
    const xs = element.points.map(p => p.x);
    const ys = element.points.map(p => p.y);
    const minX = Math.min(...xs), minY = Math.min(...ys);
    return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
  }
  return element.bounds;
}

export function getElementBounds(element: DiagramElement): Rect {
  const r = localBounds(element);
  const t = element.transform ?? IDENTITY_TRANSFORM;
  const corners = [
    transformPoint({ x: r.x, y: r.y }, t),
    transformPoint({ x: r.x + r.width, y: r.y }, t),
    transformPoint({ x: r.x, y: r.y + r.height }, t),
    transformPoint({ x: r.x + r.width, y: r.y + r.height }, t),
  ];
  const xs = corners.map(p => p.x), ys = corners.map(p => p.y);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
}

export function getDocumentBounds(document: DiagramDocument): Rect | null {
  if (document.elements.length === 0) return null;
  const bounds = document.elements.map(getElementBounds);
  const minX = Math.min(...bounds.map(b => b.x));
  const minY = Math.min(...bounds.map(b => b.y));
  const maxX = Math.max(...bounds.map(b => b.x + b.width));
  const maxY = Math.max(...bounds.map(b => b.y + b.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
