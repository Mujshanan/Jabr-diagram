# Interactive Gfx block: square spike

## Goal

Prove that Jabr Draw can provide one custom engineering-figure object to BlockSuite 0.19.5 without delegating its internal drawing model to BlockSuite surface primitives.

## Model and host boundary

The `jabr:square` model extends BlockSuite's `GfxCompatible` model wrapper and implements the Gfx geometry contract. Its `xywh`, index, rotation and lock state describe the outer Gfx object. Square-specific persistent properties are fill, stroke, stroke width and an internal editable point stored atomically as `handlePoint: [x, y]`.

The `jabr-square-gfx` custom element is registered with Lit and its view is mapped by `BlockViewExtension`. The component extends BlockSuite's `GfxBlockComponent`. BlockSuite supplies outer selection, movement, resize handles, z-order and document lifecycle. The Jabr Gfx adapter bridges the rotate-handle pointer gesture into the outer model's persisted rotation. Jabr owns the SVG content and its internal editing behavior.

## Bounding box and SVG contract

The outer Gfx model owns the canvas-space bounding box (`xywh`) and rotation. The inner SVG uses a fixed logical coordinate system (`viewBox="0 0 100 100"`) with explicit `width="100%"` and `height="100%"`. `preserveAspectRatio="xMidYMid meet"` keeps the square geometry from stretching if the host bounding box is temporarily non-square. Shapes use `vector-effect="non-scaling-stroke"` so outlines remain visually consistent during host resizing and zooming.

The SVG is content inside the Gfx wrapper; it must not write its display dimensions back into engineering parameters.

## Interaction border

- In normal mode, inner pointer events bubble to BlockSuite. Users can select and move the complete Gfx block with the host's normal canvas interactions.
- Double-click enters Jabr's internal edit mode.
- In edit mode, the internal handle's pointer events stop propagation and use pointer capture. This prevents the canvas from interpreting the handle drag as a block drag, pan or box selection.
- Clicking inside the SVG but outside the handle does not initiate a Jabr drag.
- Escape exits internal edit mode. Delete and Backspace are prevented from reaching BlockSuite while the SVG editor surface is focused.
- Clicking outside exits internal edit mode.
- Touch gesture suppression (`touch-action: none`) is scoped to edit mode so normal canvas navigation remains available.

## Interaction lifecycle and Yjs

- In edit mode, dragging the internal point uses local Lit `@state()` draft coordinates.
- Pointermove never writes to Yjs.
- Pointerup commits the completed point drag with one `doc.updateBlock()` call updating the single `handlePoint` property. Keeping both coordinates in one property avoids duplicate per-property update notifications and makes the drag one atomic document change.
- Pointer cancellation/lost capture discards the draft.
- Appearance updates use the `updateAppearance({ fill, stroke, strokeWidth })` convenience method or a host-supplied patch callback that writes through `doc.updateBlock()`. Never mutate SVG styles as a substitute for a document update. This prototype uses BlockSuite's Yjs-backed document, but does not configure a collaboration provider or claim cross-client synchronization.

## Coordinates and rotation

Pointer positions are converted from client/screen coordinates through `getScreenCTM().inverse()` and `createSVGPoint()`, rather than `offsetX/offsetY`. This accounts for CSS scaling, host zoom and high-DPI displays.

The SVG content is rotated around its 50,50 center. The resulting SVG-local pointer coordinate is inverse-rotated before it is stored in the model's unrotated 0..100 coordinate space. This keeps the handle attached to the pointer when the Gfx object is rotated. The inverse-rotation helper is unit-tested at zero, 90-degree and arbitrary angles.

## Styling and light DOM

BlockSuite 0.19.5's `GfxBlockComponent` inherits `ShadowlessElement`, whose `createRenderRoot()` returns the element itself. Its Lit styles may be injected into `document.head`; they are not isolated in a component shadow root.

Therefore all component CSS selectors are explicitly prefixed with `jabr-square-gfx`. Do not use unscoped selectors such as `svg`, `.handle` or `.square`. The rendered SVG is queried from the component's light DOM using `this.querySelector('svg')`, not `this.shadowRoot`.

## Version compatibility

BlockSuite peer and development dependencies are pinned to exact version `0.19.5`. Do not upgrade them independently of the host editor.

## Page mode

This prototype is Edgeless-only: its schema parent is `affine:surface`, and `GfxBlockComponent` renders the Edgeless Gfx view. Page mode requires a separate normal BlockSuite content-block adapter using the same Jabr figure model and SVG renderer. Do not pretend this Gfx block automatically works in PageEditor.

## Standalone Edgeless host

The repository includes a standalone test host under `demo/`, built with `AffineEditorContainer` from BlockSuite 0.19.5. It appends `SquareBlockSpec` to the preset's existing `edgelessSpecs`, registers `SquareBlockSchema` alongside `AffineSchemas`, creates an `affine:page` plus `affine:surface`, and inserts multiple sample squares. The host mounts the Properties and Layers panels and connects them to `EdgelessRootService`, its Gfx selection manager, and the document update stream.

The host also exposes Add Square, Fit View, Undo, Redo, Bring Forward and Send Backward controls. It saves a BlockSuite JSON snapshot to browser local storage and restores that snapshot on reload, allowing the prototype's scalar block properties and surface hierarchy to be checked across a reload. This is test-host persistence only, not a production persistence provider or collaboration backend.

## Automated validation

GitHub Actions runs:

- TypeScript typechecking across the core, host and Playwright tests.
- Geometry unit tests for zero-degree, 90-degree and arbitrary rotations plus clamping.
- A production Vite build.
- Playwright Chromium integration tests covering Edgeless host mounting, schema/view registration, insertion under `affine:surface`, panel visibility, layer selection, property edits, undo/redo, local snapshot save/reload, adding squares, outer Gfx movement, resize and actual rotation dragging, z-order changes, internal point dragging with exactly one document update and Escape exit, zoomed pointer mapping, and pointer-cancellation rollback.

## Remaining manual checks

The automated suite covers pointer cancellation, zoomed pointer mapping, actual outer rotation dragging, and Escape exit. Remaining manual checks include outside-click exit, copy/paste, stroke scaling at multiple viewport zoom levels, and light/dark theme behavior. Collaboration and cross-client concurrent editing belong to the later Yjs adapter milestone, not this Phase 1 host spike.

## Deliberate non-goals

- No general-purpose CAD editor.
- No D3 dependency.
- No worksheet/Jabr CLI variable bridge yet.
- No page-mode block.
