# Jabr Diagram Repository Structure

**Audit baseline:** merged `main` at `d5f8a241c2d1505563e241adfa8474a6581866dd`  
**Purpose:** Preserve the validated BlockSuite Gfx prototype while separating the future renderer-independent diagram engine from host adapters and demonstration UI.

## 1. Audit findings

The current `main` branch includes the independently validated BlockSuite Gfx integration prototype merged from PR #1. The prototype is a host adapter and demonstration, not yet the renderer-independent diagram engine.

The merged main tree contains 31 entries, including:

```text
Jabr-diagram/
├── .github/workflows/validate.yml
├── docs/
│   ├── host-panels.md
│   └── interactive-gfx-square.md
├── demo/
│   ├── main.ts
│   └── styles.css
├── e2e/
│   └── edgeless-host.spec.ts
├── src/
│   ├── blocks/square/
│   │   ├── square-model.ts
│   │   ├── square-geometry.ts
│   │   ├── square-geometry.test.ts
│   │   ├── square-gfx-block.ts
│   │   ├── square-spec.ts
│   │   └── index.ts
│   ├── panels/
│   │   ├── editor-panels.ts
│   │   └── index.ts
│   └── index.ts
├── package.json
├── index.html
├── playwright.config.ts
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

The prototype uses TypeScript, Lit and BlockSuite 0.19.5. The package declares matching BlockSuite packages as peer dependencies and also installs them for the standalone test host. Its validation workflow runs typecheck, geometry tests, production build and Chromium E2E tests.

The default branch currently has a separate `engine-demo.yml` workflow that validates the standalone demo. Preserve both workflows until their responsibilities are deliberately reconciled; do not silently replace the demo check with the prototype workflow.

## 2. What exists and what does not

### Implemented in the prototype branch

- A `jabr:square` BlockSuite Gfx model and view.
- Square geometry conversion with unit tests.
- Internal SVG point editing and pointer-capture handling.
- Rotation-handle bridging to BlockSuite's selected Gfx object.
- A standalone Edgeless test host and host panels.
- Local snapshot persistence and undo/redo validation.
- Playwright Chromium integration coverage.

The existing PR reports successful typecheck, geometry tests, production build and 10 Chromium integration tests at its recorded head. Re-run CI on the final standardization branch; do not treat historical checks as proof that new commits pass.

### Not yet implemented

- A renderer-independent diagram document model.
- A stable Rust diagram engine or Cargo workspace.
- A public Rust diagram library.
- A Rust/WASM binding.
- A reusable React component package.
- A Yjs collaboration adapter owned by the diagram subsystem.
- Jabr Studio production integration.

The square prototype is a host-integration spike, not the independent diagram engine.

## 3. Ownership boundaries

- **Diagram domain engine (future Rust):** renderer-independent document model, stable diagram element IDs, geometry, constraints, transformations and domain operations.
- **Diagram library (future Rust API):** application-independent public API, serialization and documented operations over the engine.
- **SVG/rendering adapter:** deterministic SVG or render-ready output derived from the diagram model. Rendering output must not become the canonical document model.
- **BlockSuite adapter (current TypeScript/Lit):** translates between BlockSuite model lifecycle/events and the diagram model. It owns host-specific selection, movement, resize, persistence and integration behavior.
- **Development host/demo:** minimal environment for testing the subsystem; not the product application.
- **Jabr-UI:** owns production custom blocks, complete worksheet UI, document orchestration and final product integration.

### React versus Lit

The current Gfx adapter extends BlockSuite's `GfxBlockComponent` and uses Lit. Do not rewrite it as React merely to standardize the ecosystem around React. BlockSuite's host integration remains Lit-based unless a verified adapter architecture supports React without breaking BlockSuite lifecycle, rendering or interaction contracts.

A future standalone React package may consume the Rust library and render the same domain model. It must remain separate from the BlockSuite-specific adapter and must not duplicate diagram logic.

## 4. Target structure (incremental)

The following is the intended logical structure. It is not a request to move current files immediately.

```text
Jabr-diagram/
├── crates/                       # Add when Rust engine is introduced
│   ├── diagram-engine/
│   └── diagram-library/
├── packages/                     # Add when public TS packages are justified
│   ├── diagram-types/
│   ├── diagram-react/             # Optional standalone React consumer
│   └── blocksuite-adapter/        # Host-specific Lit/BlockSuite adapter
├── src/                           # Current prototype; migrate incrementally
├── demo/                          # Minimal development host
├── e2e/
├── tests/                         # Cross-package and contract tests, when needed
├── docs/
│   ├── DEVELOPMENT.md
│   ├── REPOSITORY-STRUCTURE.md
│   ├── architecture/
│   └── api/
├── .github/workflows/
├── Cargo.toml                     # Add with first real Rust crate
└── package.json
```

Do not create empty crates or packages. First implement the independent diagram model and geometry contract; then move code only when tests prove parity.

## 5. Standard repository conventions

- `README.md`: project purpose, current implementation status, quick start and canonical documentation links.
- `docs/DEVELOPMENT.md`: setup, architecture, build, tests and workflow.
- `docs/REPOSITORY-STRUCTURE.md`: current and target ownership map.
- `docs/architecture/`: accepted model, geometry and adapter decisions.
- `docs/api/`: versioned Rust/TypeScript contracts and serialization formats.
- `src/`: current host prototype until a tested migration is approved.
- `demo/`: minimal development-only host.
- `e2e/`: browser integration tests.
- `crates/`: Rust engine/library only after real crates exist.
- `packages/`: published or independently reusable TypeScript packages only after real package boundaries exist.
- `.github/workflows/`: independent validation for demo, Rust, TypeScript and browser integration.

## 6. Independent CI requirements

Preserve the current standalone demo workflow and the prototype validation workflow.

The prototype validation workflow should continue to cover:

1. TypeScript typecheck.
2. Geometry unit tests.
3. Production build.
4. Chromium E2E tests.

When Rust crates are introduced, add independent Rust formatting, Clippy, unit/integration tests and documentation checks. When WASM is introduced, add WASM build and cross-target contract tests. Do not make the existing TypeScript prototype tests dependent on a future Rust implementation before the adapter exists.

## 7. Migration sequence

1. Preserve and complete the current Gfx square integration milestone.
2. Define a renderer-independent diagram document model outside BlockSuite.
3. Define geometry and operation APIs with deterministic unit tests.
4. Introduce the Rust engine and library behind those contracts.
5. Add a versioned TypeScript/WASM adapter without exposing Rust internals to UI.
6. Keep the BlockSuite/Lit adapter thin and host-specific.
7. Add a React package only if a separate consumer needs it.
8. Integrate mature components into Jabr-UI.
9. Add Yjs/concurrent-editing adapters only after the document model and ownership boundaries are stable.

## 8. Non-goals of this standardization

- No rewrite or removal of the working square Gfx prototype.
- No forced React conversion of the BlockSuite/Lit adapter.
- No premature Rust/WASM scaffolding or empty crates.
- No change to BlockSuite 0.19.5 behavior or dependency versions.
- No replacement of the current test host with Jabr Studio.
- No deletion or consolidation of existing CI workflows.
- No merge or retarget of existing pull requests.

This document records the audited implementation and an incremental target. Engine extraction and package creation require separate, focused implementation changes with tests.
