# Jabr Draw

Jabr Draw is an independent engineering-figure engine. Its core figure models and renderers are intended to remain independent of BlockSuite; host integrations live in adapters.

The first host-integration spike is a **square Gfx block** for BlockSuite **0.19.5**.

## Current prototype

- `jabr:square` is a Gfx-compatible block model stored under `affine:surface`.
- `jabr-square-gfx` is a `GfxBlockComponent` that renders the square as SVG.
- BlockSuite owns the outer object's selection, movement, rotation, resizing, layer order and document persistence.
- Jabr supplies the SVG appearance and square-specific properties (fill, stroke and stroke width).

This is deliberately a host-integration spike, not yet the complete Jabr Draw engine or a standalone demo application.

## Package

The adapter expects the consuming application to use matching BlockSuite packages:

- `@blocksuite/block-std@0.19.5`
- `@blocksuite/store@0.19.5`
- `@blocksuite/global@0.19.5`
- `lit`

Install this package in the same dependency graph as the host editor. Do not install a second, different BlockSuite version alongside the host.

## Registering the block

Register both parts of the block:

1. Add `SquareBlockSchema` to the document schema with `new Schema().register([...])` (the BlockSuite 0.19.5 registration API).
2. Add `SquareBlockSpec` to the editor's block view extensions.

Exports are available from `src/index.ts`. The exact editor bootstrap is intentionally left to the host application because Jabr Draw does not own the AFFiNE/BlockSuite editor instance.

Register `SquareBlockSchema` with the document's `Schema` before creating the `DocCollection`. Register `SquareBlockSpec` in the `BlockStdScope` extensions. BlockSuite 0.19.5 does not use the newer `BlockSchemaExtension` API.

The block's schema declares `affine:surface` as its parent. It is therefore intended for an Edgeless surface, not as a normal page-flow content block.

## Interaction boundary

For this first spike, the square is one complete Gfx object:

- Click/select, move, rotate and z-order are host operations.
- The SVG is rendered inside the Gfx block.
- The SVG preserves its square aspect ratio when the outer Gfx bounds are resized.
- Engineering-specific internal selection, dimension editing, constraints and parameter binding are not implemented yet.

Do not turn each SVG path or annotation into a separate BlockSuite surface element. Jabr Draw should own those internal objects in later milestones.

## Validation status

This initial commit establishes the adapter source and type-check configuration. It still needs to be compiled against a real BlockSuite 0.19.5 host and exercised in an Edgeless editor. In particular, verify schema registration, insertion, selection, movement, resize handles, rotation, copy/paste, persistence and undo/redo before treating the adapter as integration-ready.
