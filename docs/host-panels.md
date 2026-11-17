# Host-side properties and layers panels

Jabr Draw exports two optional Lit components from `src/panels/editor-panels.ts`.

## Properties panel

`<jabr-properties-panel>` displays the selected square's outer transform, appearance, and internal handle coordinates. The host supplies its `model` and an `onUpdate(patch)` callback. The callback must persist patches through `doc.updateBlock(selectedModel, patch)`.

```ts
propertiesPanel.model = selectedSquare;
propertiesPanel.onUpdate = patch => {
  if (selectedSquare) doc.updateBlock(selectedSquare, patch);
};
```

The panel does not mutate the model or SVG directly. It edits the outer `xywh` rectangle, rotation, fill, stroke, stroke width, and the prototype's internal handle coordinates.

## Layers panel

`<jabr-layers-panel>` displays a flattened hierarchy supplied by the host. Each row has an ID, label, flavour, optional depth, kind, and selected state. The host supplies `items` and an `onSelect(id)` callback connected to BlockSuite's selection service.

```ts
layersPanel.items = surfaceChildren.map((model, index) => ({
  id: model.id,
  label: model.flavour === 'jabr:square' ? `Square ${index + 1}` : model.flavour,
  flavour: model.flavour,
  depth: 1,
  selected: model.id === selectedModel?.id,
  kind: 'element',
}));
layersPanel.onSelect = id => selectGfxElement(id);
```

`selectGfxElement` is host-specific pseudocode; wire it to the selection service exposed by the chosen BlockSuite Edgeless host. The panel does not enumerate surface children or own document state.

## Current limits

These are host-side UI components, not part of the Jabr Draw diagram model. The layers view currently supports hierarchy display and selection only. Visibility toggles, locking controls, grouping, drag-reordering, and automatic BlockSuite selection synchronization remain future host-adapter work. The standalone live Edgeless host is still required to verify the complete editor lifecycle.
