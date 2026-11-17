# Jabr Draw

Jabr Draw is an independent engineering-figure engine. Its core figure models and renderers are intended to remain independent of BlockSuite; host integrations live in adapters.

The first host-integration spike is a **square Gfx block** for BlockSuite **0.19.5**.

## Current prototype

- `jabr:square` is a Gfx-compatible block model stored under `affine:surface`.
- `jabr-square-gfx` is a `GfxBlockComponent` that renders the square as SVG.
- BlockSuite owns the outer object's selection, movement, rotation, resizing, layer order and document lifecycle.
- Jabr supplies the SVG appearance, internal edit interaction and persistent style properties.
- Pointer-to-model coordinate conversion accounts for the square's visual rotation.

This is deliberately a host-integration spike, not yet the complete Jabr Draw engine. The repository now includes a standalone BlockSuite Edgeless host for live integration checks.

## Package

The adapter expects the consuming application to use matching BlockSuite packages:

- `@blocksuite/block-std@0.19.5`
- `@blocksuite/store@0.19.5`
- `@blocksuite/global@0.19.5`
- `lit@3.2.1`

Install this package in the same dependency graph as the host editor. Do not install a second, different BlockSuite version alongside the host.

## Registering the block

Register the schema alongside the host's existing schemas, before creating the collection:

```ts
const schema = new Schema().register([
  ...AffineSchemas,
  SquareBlockSchema,
]);
const collection = new DocCollection({ schema });
```

Add the view spec to the host's **existing Edgeless extension set**. Do not replace the host's normal extensions with this one extension:

```ts
const std = new BlockStdScope({
  store: doc,
  extensions: [
    ...hostEdgelessExtensions,
    ...SquareBlockSpec,
  ],
});
```

The exact extension composition depends on the host editor. The host must already provide its normal Edgeless services, viewport, surface and selection extensions. `SquareBlockSpec` only registers the custom view.

The block's schema declares `affine:surface` as its parent. It is therefore intended for an Edgeless surface, not as a normal page-flow content block.

To insert a square into an initialized page:

```ts
doc.load(() => {
  const pageId = doc.addBlock('affine:page', {
    title: new Text('Gfx prototype'),
  });
  const surfaceId = doc.addBlock('affine:surface', {}, pageId);
  doc.addBlock('jabr:square', {}, surfaceId);
});
```

## Interaction boundary

For this first spike, the square is one complete Gfx object:

- In normal mode, pointer events bubble to BlockSuite so the user can select and move the complete square.
- Double-click enters Jabr's internal edit mode; drag the internal point to reposition it.
- Internal handle events stop propagation and use pointer capture.
- Escape exits internal edit mode; Delete and Backspace are suppressed while the SVG editor surface is focused.
- Clicking outside exits internal edit mode.
- The point drag is committed once on pointerup, not on every pointermove.
- Pointer cancellation discards the local draft.
- The SVG uses a responsive 100-by-100 viewBox, explicit 100% width/height and non-scaling strokes.
- Pointer coordinates are inverse-rotated into the square's model coordinate system before persistence.

Appearance changes are persisted using the component's `updateAppearance({ fill, stroke, strokeWidth })` method. A host property panel should call that method; it must not directly alter SVG presentation or mutate the model outside BlockSuite's document update API.

Do not turn each SVG path or annotation into a separate BlockSuite surface element. Jabr Draw should own those internal objects in later milestones.

## Styling and BlockSuite's shadowless component base

In BlockSuite 0.19.5, `GfxBlockComponent` inherits `ShadowlessElement`. Its render root is the element itself, and Lit styles can be injected into the document head. These styles are **not** safely isolated in a shadow root.

Consequently, every selector in the square component is prefixed with `jabr-square-gfx`. Avoid generic selectors such as `svg`, `.handle` or `.square` in this component's styles. Query rendered content from the component's light DOM (for example, `this.querySelector('svg')`), not from `this.shadowRoot`.

## Run the standalone Edgeless host

Use Node.js 22 and npm:

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:4173`. The host creates a real BlockSuite 0.19.5 document, registers the custom square spec alongside the standard Edgeless specs, inserts three sample squares, and mounts the Layers and Properties panels. Use **Add square** to insert more test blocks. Select a square in Layers, edit its properties, reorder it, or double-click its SVG to drag the internal point. Undo/Redo and local snapshot persistence are included for testing.

Run automated validation with:

```bash
npx playwright install chromium
npm run validate
```

Validation includes TypeScript, geometry unit tests, a production Vite build, and Playwright browser tests for host mounting, layer selection, property persistence, undo/redo, snapshot reload, insertion, outer movement/resizing/rotation, z-order, and internal point editing.

## Host-side panels

Optional Lit components are exported as `jabr-properties-panel` and `jabr-layers-panel`. They are host-owned UI: the Edgeless host supplies the selected model, layer rows, selection callback, and a document-update callback. See [`docs/host-panels.md`](docs/host-panels.md) for the contract and wiring example. They do not couple the diagram core to BlockSuite selection services.

## Validation

Automated validation is configured in GitHub Actions:

- TypeScript typecheck against exact BlockSuite 0.19.5 packages.
- Unit tests for zero, 90-degree and arbitrary-angle coordinate conversion, plus coordinate clamping.

The automated checks do not replace live-editor validation. Before treating this adapter as integration-ready, run it in a real BlockSuite 0.19.5 Edgeless host and verify:

1. Schema and view extension registration.
2. Insertion under `affine:surface`.
3. Selection, move, resize, rotate and z-order.
4. SVG scaling and stroke behavior at different Gfx bounding-box sizes.
5. Normal pointer pass-through and edit-mode gesture isolation.
6. Exactly one undo step for a completed point drag.
7. Appearance changes through `updateAppearance()`, including undo/redo and collaboration.
8. Pointer capture, Escape, outside click and pointercancel behavior.
9. Correct pointer mapping at multiple zoom levels and rotation angles.
10. Light/dark theme mapping, copy/paste and save/reload.

## Scope

This prototype is Edgeless-only. Page mode requires a separate normal content-block adapter using the same Jabr figure model and renderer.

Deliberate non-goals:

- No general-purpose CAD editor.
- No D3 dependency.
- No worksheet/Jabr CLI variable bridge yet.
- No page-mode block.
- No Yjs-native internal diagram graph yet; this prototype stores only a few scalar block properties.
