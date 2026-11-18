# Jabr Diagram Development Guide

## Purpose

Jabr Diagram is an independently developable engineering-diagram subsystem. Its long-term domain model and geometry engine must remain independent of BlockSuite and any rendering framework.

The current implementation is a BlockSuite 0.19.5 Gfx integration prototype. It is a development host/adapter, not yet the complete renderer-independent diagram engine.

## Jabr ecosystem ownership (2026-11-18)

Jabr Diagram owns the renderer-independent diagram model, geometry and diagram-domain operations. Kernel may provide generic primitives, but Diagram owns its own element identity and semantics unless a shared primitive is demonstrably useful. The planned Jabr-engine repository is the worksheet calculation orchestrator; it is not the same thing as the Diagram domain engine. Jabr-engine may consume Diagram APIs, but Diagram does not own worksheet graph construction, Math parsing, or recalculation. Jabr-UI owns production custom blocks and document persistence. The current Lit/BlockSuite Gfx host remains a development adapter.

## Requirements

- Node.js 22
- npm
- Git
- Playwright Chromium for browser integration tests

The current prototype uses TypeScript, Lit, Vite, Vitest, Playwright and exact BlockSuite 0.19.5 dependencies. Keep BlockSuite versions aligned with the consuming host.

## Setup

From the repository root:

```bash
npm install
npx playwright install chromium
```

## Development host

```bash
npm run dev
```

Open `http://127.0.0.1:4173`.

The standalone Edgeless host is for developing and validating the Gfx adapter. It is not the production Jabr Studio shell and its local snapshot persistence is not a production collaboration provider.

## Validation

Run the complete current validation sequence:

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Or run:

```bash
npm run validate
```

The independent checks cover TypeScript, geometry conversion, production bundling and Chromium host integration. Keep geometry tests independent from BlockSuite where possible. Browser tests validate host lifecycle, Gfx interactions, persistence updates, undo/redo and pointer behavior.

## Architecture boundaries

- Keep the domain model and geometry operations independent of BlockSuite.
- Keep BlockSuite-specific schemas, lifecycle and Gfx interactions in the host adapter.
- Keep Lit in the current BlockSuite Gfx adapter; do not force a React rewrite.
- Keep the standalone host minimal and focused on engine/adapter development.
- Do not move production block ownership from Jabr-UI into this repository.
- Do not persist transient selection, pointer drafts or rendering caches as authored diagram data.
- Use stable element IDs; array positions are not durable identities.
- Keep renderer output (including SVG) derived from the document model.
- Introduce Rust crates only when the renderer-independent model and geometry contracts are defined and tested.

## Current and planned responsibilities

| Area | Current state |
|---|---|
| BlockSuite Gfx square prototype | Implemented on the prototype branch |
| Standalone Edgeless test host | Implemented on the prototype branch |
| Geometry conversion tests | Implemented |
| Renderer-independent diagram model | Planned |
| Rust diagram engine/library | Planned |
| Versioned Rust/WASM adapter | Planned |
| Standalone React components | Optional future package |
| Production Jabr-UI blocks | Owned by Jabr-UI |

See [REPOSITORY-STRUCTURE.md](REPOSITORY-STRUCTURE.md) for the audited tree and incremental package plan. See [interactive-gfx-square.md](interactive-gfx-square.md) for the prototype's detailed host and interaction contract.

## Contribution rules

1. Inspect the current implementation and open pull requests before changing files.
2. Preserve the validated Gfx prototype and its independent CI.
3. Add focused unit tests for geometry/model behavior and browser tests for host integration.
4. Do not introduce empty crates/packages or speculative dependencies.
5. Keep changes scoped; do not combine engine extraction with host UI rewrites.
6. Report exact commands and observed results. Do not claim checks passed unless run.
7. Do not merge or retarget pull requests without explicit authorization.


## Renderer-independent Diagram document v1

The initial versioned document model and Square Gfx adapter are specified in [DIAGRAM-DOCUMENT-V1.md](api/DIAGRAM-DOCUMENT-V1.md). The model is independent of BlockSuite; the existing square adapter is a host-specific conversion layer. Keep Gfx-only properties in namespaced extension metadata and reject lossy reverse conversions.

Validation for this milestone includes the model unit tests, golden fixture round-trip, TypeScript typecheck, production build and Chromium Edgeless integration tests. This model is not yet the final diagram engine or a Rust/WASM bridge.
