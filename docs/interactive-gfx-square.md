# Interactive Gfx block: square spike

## Goal

Prove that Jabr Draw can provide one custom engineering-figure object to BlockSuite 0.19.5 without delegating its internal drawing model to BlockSuite surface primitives.

## Model

The `jabr:square` model extends BlockSuite's `GfxCompatible` model wrapper and implements the Gfx geometry contract. It supplies the required outer Gfx properties:

- `xywh`: position and bounds in Edgeless model coordinates
- `index`: layer ordering
- `rotate`: host rotation
- `scale`: model scale
- `lockedBySelf`: host lock state

Square-specific properties are deliberately small: `fill`, `stroke` and `strokeWidth`.

## View

The `jabr-square-gfx` component extends `GfxBlockComponent`. It renders one SVG rectangle with `preserveAspectRatio="xMidYMid meet"`, so changing the host bounding-box aspect ratio does not distort the visible square.

The component does not implement its own outer drag/resize/rotate handles. Those belong to BlockSuite's Gfx controller and selection widgets.

## What this spike proves

- A custom schema can describe a Gfx-compatible block.
- A custom Lit view can render it through `GfxBlockComponent`.
- The SVG renderer can stay inside Jabr Draw while BlockSuite manages the outer object.

## What remains to verify in a real host

1. Register the schema extension and view extension in a BlockSuite 0.19.5 editor.
2. Insert the model as a child of `affine:surface`.
3. Confirm the Gfx controller discovers and renders it.
4. Verify selection, move, resize, rotate and z-order.
5. Verify copy/paste, save/reload and undo/redo.
6. Confirm model property updates refresh the view.
7. Add an automated integration test using the same BlockSuite version as Jabr-UI.

## Deliberate non-goals

- No free-form canvas editor.
- No D3 dependency.
- No worksheet/Jabr CLI variable bridge yet.
- No internal SVG element selection yet.
- No page-mode block yet.
