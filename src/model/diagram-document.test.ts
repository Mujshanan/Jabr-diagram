import { describe, expect, it } from 'vitest';
import {
  getDocumentBounds,
  getElementBounds,
  transformPoint,
  validateDiagramDocument,
  type DiagramDocument,
} from './diagram-document.js';

const documentFixture = (): DiagramDocument => ({
  schemaVersion: 1,
  id: 'diagram-1',
  coordinateSystem: { unit: 'mm', origin: 'top-left', yAxis: 'down' },
  elements: [
    { kind: 'rectangle', id: 'rect-1', bounds: { x: 10, y: 20, width: 30, height: 40 } },
    { kind: 'line', id: 'line-1', points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] },
  ],
});

describe('diagram document validation', () => {
  it('accepts a valid renderer-independent document', () => {
    expect(validateDiagramDocument(documentFixture())).toEqual([]);
  });

  it('rejects duplicate element IDs and invalid geometry', () => {
    const doc = documentFixture();
    doc.elements.push({ kind: 'polyline', id: 'rect-1', points: [{ x: 0, y: 0 }] });
    const issues = validateDiagramDocument(doc);
    expect(issues.map(issue => issue.code)).toContain('duplicate-id');
    expect(issues.map(issue => issue.code)).toContain('too-few-points');
  });

  it('rejects zero scale and non-finite coordinates', () => {
    const doc = documentFixture();
    doc.elements[0]!.transform = {
      translateX: 0, translateY: 0, rotationDegrees: 0, scaleX: 0, scaleY: 1,
    };
    doc.elements[1] = {
      kind: 'line', id: 'line-1',
      points: [{ x: Number.NaN, y: 0 }, { x: 1, y: 1 }],
    };
    const issues = validateDiagramDocument(doc);
    expect(issues.map(issue => issue.code)).toContain('invalid-transform');
    expect(issues.map(issue => issue.code)).toContain('invalid-point');
  });
});

describe('diagram geometry', () => {
  it('applies scale, then rotation, then translation', () => {
    expect(transformPoint(
      { x: 2, y: 0 },
      { translateX: 10, translateY: 5, rotationDegrees: 90, scaleX: 2, scaleY: 1 },
    ).x).toBeCloseTo(10);
    expect(transformPoint(
      { x: 2, y: 0 },
      { translateX: 10, translateY: 5, rotationDegrees: 90, scaleX: 2, scaleY: 1 },
    ).y).toBeCloseTo(9);
  });

  it('supports mirrored elements', () => {
    expect(transformPoint(
      { x: 3, y: 4 },
      { translateX: 0, translateY: 0, rotationDegrees: 0, scaleX: -1, scaleY: 1 },
    )).toEqual({ x: -3, y: 4 });
  });

  it('returns transformed axis-aligned bounds', () => {
    const element = {
      kind: 'rectangle' as const, id: 'r',
      bounds: { x: 0, y: 0, width: 10, height: 20 },
      transform: { translateX: 5, translateY: 7, rotationDegrees: 90, scaleX: 1, scaleY: 1 },
    };
    expect(getElementBounds(element).x).toBeCloseTo(-15);
    expect(getElementBounds(element).y).toBeCloseTo(7);
    expect(getElementBounds(element).width).toBeCloseTo(20);
    expect(getElementBounds(element).height).toBeCloseTo(10);
  });

  it('returns null bounds for an empty document and unions element bounds otherwise', () => {
    const doc = documentFixture();
    expect(getDocumentBounds({ ...doc, elements: [] })).toBeNull();
    expect(getDocumentBounds(doc)).toEqual({ x: 0, y: 0, width: 40, height: 60 });
  });
});
