# Jabr Diagram

A focused diagram-engine workbench for developing and testing Jabr's diagram model independently from the main worksheet UI.

## Run the UI prototype

The current prototype is dependency-free. Open index.html directly in a browser or serve this directory with any static file server.

It provides:

- A vector canvas with rectangle, ellipse, line and text tools
- Selection and drag movement
- A lightweight object/layer list
- An inspector for geometry, fill, stroke and naming
- SVG export
- Keyboard tool shortcuts: V, R, O, L, T and Delete

The prototype keeps its objects in memory. It is an interaction harness, not the diagram engine's document model, persistence layer or collaboration implementation.

## Responsibility boundary

- **Jabr Diagram** owns diagram geometry, object model, constraints, transformations, serialization, import/export semantics and collaboration adapters.
- **Jabr Diagram UI prototype** exists only to exercise engine behavior during independent development.
- **Jabr-UI** owns the production diagram block, worksheet-level controls, shared document experience and cross-component integration.

Do not add a second production worksheet shell here. When the engine API stabilizes, Jabr-UI should consume it through a small adapter rather than importing prototype UI code.

## Prototype status

The canvas currently uses a small local SVG interaction model. It does not yet call a diagram engine, persist documents, synchronize Yjs state or guarantee engineering drawing precision. Treat all content as disposable test data.
