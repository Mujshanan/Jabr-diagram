# Jabr Diagram Document Model v1

**Status:** TypeScript reference model and geometry contract, implemented independently of BlockSuite. The Rust workspace is deliberately deferred until these contracts pass tests.

## Design invariants

- The document model is canonical authored data; SVG, canvas pixels, BlockSuite Gfx models and editor state are derived/adapted representations.
- Element IDs are stable and unique within a document. Array order is z-order, not identity.
- Geometry uses logical document coordinates, never CSS pixels or viewport coordinates.
- The v1 coordinate convention is origin at top-left with positive Y downward. Units are an explicit document-level string.
- Element transforms are local-to-document: scale, then rotate around the local origin, then translate.
- Selection, pointer drafts, viewport, zoom, hover, tool state, editor panels and BlockSuite lifecycle are not part of the document.
- Unknown future element kinds or schema versions must be rejected or preserved as opaque data by a version-aware importer; never silently reinterpret them.

## v1 document

```ts
type DiagramDocument = {
  schemaVersion: 1;
  id: string;
  coordinateSystem: { unit: string; origin: 'top-left'; yAxis: 'down' };
  elements: DiagramElement[]; // array order is z-order
};

type DiagramElement =
  | { kind: 'line'; id: string; points: [Point, Point]; transform?: Transform; style?: Style }
  | { kind: 'polyline'; id: string; points: Point[]; closed?: boolean; transform?: Transform; style?: Style }
  | { kind: 'rectangle' | 'ellipse' | 'text'; id: string; bounds: Rect; transform?: Transform; style?: Style; text?: string };
```

The executable TypeScript types in `src/model/diagram-document.ts` are authoritative for this first reference implementation. The Rust representation must later pass the same JSON fixtures and geometry golden tests.

## Geometry rules

- Coordinates, dimensions, rotation and scale must be finite numbers.
- Rectangle/ellipse/text bounds use non-negative width and height.
- A line has exactly two points; a polyline has at least two.
- Transform scale components cannot be zero. Negative scale is allowed for mirroring.
- Stroke width is non-negative.
- Transform order is scale -> rotation in degrees -> translation.
- Bounds are axis-aligned document-space bounds after transformation. For rotated rectangles/text they are the enclosing bounds of the four transformed corners; this is a conservative box for ellipse.
- Empty documents have no bounds (`null`), not a fabricated zero-sized rectangle.

## Separation from adapters

| Layer | Responsibility |
|---|---|
| Renderer-independent model | Document schema, IDs, geometry, transforms, validation |
| Rust engine (future) | Geometry operations, constraints, layout and deterministic export core |
| TypeScript reference model | Contract implementation and golden tests before Rust exists |
| SVG adapter | Converts model to deterministic SVG; no authored state |
| BlockSuite/Lit adapter | Maps model to Gfx block lifecycle, selection, pointer events and host undo/redo |
| Optional React adapter | Separate consumer only if needed; no duplicated geometry |
| Jabr-UI | Production custom blocks, document persistence/collaboration and Studio UX |

The current `jabr:square` BlockSuite model remains a host adapter/prototype. It must map to/from this model; it is not the canonical domain schema.

## Rust workspace gate

Do not add `Cargo.toml`, Rust crates, wasm-bindgen or generated WASM yet. First require:

1. TypeScript typecheck passes.
2. Model validation tests cover all v1 element kinds and invalid data.
3. Geometry tests cover transform order, rotation, mirroring, degenerate bounds and document bounds.
4. Golden JSON fixtures are stable and round-trip without loss.
5. Existing BlockSuite Gfx tests and Chromium E2E remain green.
6. A migration adapter proves the current square maps to/from the renderer-independent model without changing its user-visible behavior.

Only after this gate should the Rust workspace be introduced, with the same fixtures consumed by Rust tests.
