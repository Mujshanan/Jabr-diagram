# Jabr Draw

Jabr Draw is an independent engineering-figure engine. Its core figure models and renderers are intended to remain independent of BlockSuite; host integrations live in adapters.

The first host-integration spike is a **square Gfx block** for BlockSuite **0.19.5**.

## Current prototype

- `jabr:square` is a Gfx-compatible block model stored under `affine:surface`.
- `jabr-square-gfx` is a `GfxBlockComponent` that renders the square as SVG.
- BlockSuite owns the outer object's selection, movement, rotation, resizing, layer order and document persistence.
- Jabr supplies the SVG appearance, internal edit interaction and persistent style properties.

This is deliberately a host-integration spike, not yet the complete Jabr Draw engine or a standalone demo application.

## Package

The adapter expects the consuming application to use matching BlockSuite packages:

- `@blocksuite/block-std@0.19.5`
- `@blocksuite/store@0.19.5`
- `@blocksuite/global@0.19.5`
- `lit`

Install this package in the same dependency graph as the host editor. Do not install a second, different BlockSuite version alongside the host.

## Registering the block

Register both parts using the BlockSuite 0.19.5 APIs:

```ts
const schema = new Schema().register([
  // the host's existing schemas
  SquareBlockSchema,
]);
const collection = new DocCollection({ id: 'jabr', schema });
const std = new BlockStdScope({
  doc,
  extensions: [...SquareBlockSpec],
});
```

Register the schema before creating the `DocCollection`; register the view extension in the `BlockStdScope`. BlockSuite 0.19.5 does not use the newer `BlockSchemaExtension` API. Exports are available from `src/index.ts`; the host application remains responsible for its editor bootstrap.

The block's schema declares `affine:surface` as its parent. It is therefore intended for an Edgeless surface, not as a normal page-flow content block.

## Interaction boundary

For this first spike, the square is one complete Gfx object:

- In normal mode, pointer events bubble to BlockSuite so the user can select and move the complete square.
- Double-click enters Jabr's internal edit mode; drag the internal point to reposition it.
- Internal handle events stop propagation and use pointer capture.
- Escape or clicking outside exits internal edit mode.
- The point drag is committed once on pointerup, not on every pointermove.
- The SVG uses a responsive 100-by-100 viewBox, explicit 100% width/height and non-scaling strokes.

Appearance changes are persisted using the component's `updateAppearance({ fill, stroke, strokeWidth })` method. A host property panel should call that method; it must not directly alter SVG presentation or mutate the model outside BlockSuite's document update API.

Do not turn each SVG path or annotation into a separate BlockSuite surface element. Jabr Draw should own those internal objects in later milestones.

## Validation status

This source prototype still needs to be compiled against a real BlockSuite 0.19.5 host and exercised in an Edgeless editor. Verify schema registration, insertion, bounding-box resize behavior, pointer pass-through, edit-mode isolation, undo/redo for both geometry and style, collaboration, copy/paste and persistence before treating the adapter as integration-ready.
