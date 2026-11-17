# Interactive Gfx block: square spike

## Goal

Prove that Jabr Draw can provide one custom engineering-figure object to BlockSuite 0.19.5 without delegating its internal drawing model to BlockSuite surface primitives.

## Model and host boundary

The `jabr:square` model extends BlockSuite's `GfxCompatible` model wrapper and implements the Gfx geometry contract. Its `xywh`, index, rotation and lock state describe the outer Gfx object. Square-specific persistent properties are fill, stroke, stroke width and an internal editable point.

The component extends BlockSuite's `GfxBlockComponent`. BlockSuite owns outer selection, movement, resizing, rotation, z-order and document lifecycle. Jabr owns the SVG content and its internal editing behavior.

## Interaction lifecycle

- Single click remains available to BlockSuite for normal Gfx selection.
- Double-click enters Jabr's internal edit mode.
- In edit mode, dragging the internal point uses local Lit `@state()` draft coordinates.
- Pointer events for the internal handle stop propagation so the canvas does not interpret the drag as a canvas gesture.
- The SVG captures the active pointer, and releases it on pointerup.
- Escape or a pointerdown outside the block exits edit mode.
- A completed drag performs exactly one `doc.updateBlock()` call. Pointermove never writes to Yjs, so one drag is one persistent history operation.
- Pointer cancellation discards the draft.

## Coordinates and responsive sizing

The SVG uses a responsive `viewBox`, `width: 100%` and `height: 100%`. Pointer positions are converted from client/screen coordinates through `getScreenCTM().inverse()` and `createSVGPoint()`, rather than `offsetX/offsetY`. This accounts for CSS scaling, host zoom and high-DPI displays.

## Styling

All styles are declared in the Lit component's static styles. The drawing uses Jabr CSS custom properties with safe fallbacks:

- `--jabr-draw-square-fill`
- `--jabr-draw-square-stroke`
- `--jabr-draw-square-handle`
- `--jabr-draw-selection`

The host application can map these tokens to its light/dark theme palette. No external utility CSS is required inside the component's shadow root.

## Version compatibility

BlockSuite peer dependencies are pinned to exact version `0.19.5`. Do not upgrade them independently of the host editor.

## Page mode

This prototype is Edgeless-only: its schema parent is `affine:surface`, and `GfxBlockComponent` renders the Edgeless Gfx view. Page mode requires a separate normal BlockSuite content-block adapter using the same Jabr figure model and SVG renderer. Do not pretend this Gfx block automatically works in PageEditor.

## Validation still required

The source changes implement the intended safeguards, but they have not yet been compiled or exercised in a live BlockSuite 0.19.5 host. Verify:

1. Schema and view extension registration.
2. Insertion under `affine:surface`.
3. Selection, move, resize, rotate and z-order.
4. Double-click edit mode and normal canvas selection outside it.
5. Pointer capture when dragging beyond the SVG boundary.
6. No canvas pan/box-select while dragging the internal handle.
7. Exactly one undo step for a completed drag; no persistent update during pointermove.
8. Escape, outside click and pointercancel behavior.
9. Correct pointer mapping at multiple zoom levels and CSS sizes.
10. Light/dark theme token mapping, copy/paste, save/reload and redo.

## Deliberate non-goals

- No general-purpose CAD editor.
- No D3 dependency.
- No worksheet/Jabr CLI variable bridge yet.
- No page-mode block yet.
