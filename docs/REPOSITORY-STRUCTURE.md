# Jabr Diagram Repository Structure

**Audit baseline:** `feat/interactive-gfx-square` at `0d155e08b7ffbe41551421bde0e7f77d328cc7d5`  
**Purpose:** Preserve the validated BlockSuite Gfx prototype while developing a renderer-independent domain model before introducing Rust.

## 1. Current audited implementation

The repository contains a TypeScript/Lit/BlockSuite 0.19.5 Gfx square prototype and its standalone Edgeless validation host. The prototype owns host lifecycle, selection, pointer handling, local persistence and undo/redo integration. It is not the canonical diagram domain model.

The current feature branch adds a renderer-independent TypeScript reference model at `src/model/diagram-document.ts`, with contract tests at `src/model/diagram-document.test.ts`. This is the first implementation of the v1 document/geometry contract, not yet a Rust engine.

## 2. Ownership boundaries

- **Renderer-independent model:** schema-versioned authored document, stable element IDs, logical coordinates, geometry, transforms and validation.
- **Future Rust engine/library:** reusable domain operations, constraints, layout and deterministic export. Do not create its Cargo workspace until the TypeScript model/geometry gate passes.
- **SVG/rendering adapter:** deterministic rendering derived from the model; no canonical authored state.
- **BlockSuite/Lit adapter:** translates model data to/from BlockSuite Gfx; owns host lifecycle, selection, pointer events and host undo/redo.
- **Development host/demo:** minimal environment for testing the adapter; not the product application.
- **Jabr-UI:** owns production custom blocks, complete worksheet UX, AFFiNE persistence/collaboration and Studio integration.
- **Optional React consumer:** may be a separate package only if a real consumer requires it; never rewrite the current BlockSuite adapter as React for symmetry.

## 3. Model v1

See [DIAGRAM-DOCUMENT-V1.md](api/DIAGRAM-DOCUMENT-V1.md) for the schema, coordinate rules, geometry contract and Rust workspace gate.

The initial v1 model supports line, polyline, rectangle, ellipse and text elements. It uses document logical units, top-left origin, positive Y downward and scale-rotate-translate transform order. Selection, viewport, pointer drafts and rendering caches are excluded.

## 4. Migration sequence

1. Keep the existing square Gfx prototype intact.
2. Implement and test the renderer-independent TypeScript document model and geometry contracts.
3. Add an explicit mapping between the square Gfx block and the document model; prove round-trip behavior.
4. Only after model, geometry, golden fixture and existing host tests pass, introduce a Rust workspace consuming the same fixtures.
5. Add a versioned WASM/native adapter and keep it separate from domain code.
6. Extract packages only when independently reusable boundaries are proven by consumers.

Do not move the current prototype files wholesale or create empty crates/packages. Preserve the current independent CI workflows and add Rust validation as a separate job when the Rust gate is met.

## 5. Validation

Current TypeScript validation remains:

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
```

The new model tests must be independent of BlockSuite. Existing Gfx tests and Chromium E2E remain necessary to protect host behavior. Rust format/Clippy/unit tests and cross-language golden fixtures become required only after the Rust workspace is introduced.
