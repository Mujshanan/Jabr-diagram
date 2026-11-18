# ADR-001: Rust-owned Diagram core with WebAssembly delivery

**Status:** Accepted architectural direction  
**Date:** 2026-11-19  
**Scope:** Jabr Diagram core implementation language and runtime boundary

## Decision

Jabr Diagram will have an authoritative Rust core, compiled to WebAssembly for browser use. TypeScript remains at the browser and host-integration boundary; it will not be a second authoritative implementation of diagram semantics.

The existing TypeScript Diagram v1 model and geometry helpers may be retained temporarily as a migration/reference implementation and as a source of fixtures. Do not expand them with new domain behavior while the Rust core is being established.

## Ownership

- **Rust Diagram core:** canonical diagram document types, geometry, transforms, validation, deterministic operations, and serialization.
- **WASM boundary:** versioned browser-facing API for invoking the Rust core and returning structured results.
- **TypeScript integration:** typed WASM wrapper, browser lifecycle, event translation, and host-specific adapters.
- **BlockSuite adapter:** thin conversion between BlockSuite/Gfx state and the canonical Diagram document. It must not own canonical geometry or persistence semantics.
- **Jabr-UI:** production worksheet block, editing UX, document persistence and collaboration integration.
- **Jabr-engine:** worksheet graph integration, dependency interpretation, scheduling and execution. Diagram does not become a worksheet scheduler.
- **Jabr-Kernel:** generic infrastructure only; it does not acquire diagram-specific geometry or document types.

## Kernel boundary

The Rust core must consume only Kernel's supported public contract, never Kernel implementation internals. Use the dedicated versioned public API boundary when it is available to consumers.

Diagram identifiers must conform to Kernel's JavaScript-safe non-zero integer ID range. Diagnostics, source spans, and versioned JSON envelopes must use the shared Kernel wire shapes rather than parallel Diagram-specific copies. Diagram-specific diagnostic codes remain owned and namespaced by Diagram.

The Diagram document schema version remains distinct from the Kernel transport-envelope schema version. A document version describes authored diagram data; an envelope version describes the transport wrapper.

## Migration and compatibility

1. Keep the current TypeScript model stable while the Rust contract is introduced.
2. Treat the existing JSON golden fixture as language-neutral contract data.
3. Add Rust tests that deserialize, validate, serialize, and reproduce the same fixture.
4. Add cross-language conformance tests for geometry and adapter round-trips.
5. Move authoritative validation and geometry semantics to Rust; remove duplicated TypeScript domain logic after parity is demonstrated.
6. Keep the BlockSuite adapter thin and reject lossy conversions explicitly.

No Rust workspace, WASM package, or production adapter implementation is introduced by this decision record alone. Those are subsequent implementation work, gated by the Kernel public API and the Diagram v1 contract audit.

## Consequences

- Diagram aligns with the Rust-first Kernel, Math, and Table architecture and the planned Rust Engine.
- Browser clients use the same authoritative semantics as native Rust consumers.
- TypeScript-only consumers must cross the explicit WASM boundary rather than maintain a separate geometry engine.
- WASM build, packaging, and browser test costs are accepted in exchange for one authoritative implementation.
- The existing TypeScript v1 work remains useful as a migration reference, but is not the long-term core.

## Deferred decisions

This ADR does not finalize coordinate units, angle conventions, transform composition, geometry edge cases, the exact WASM ABI, Engine input/output bindings, or the final public Diagram API. These require separate contract decisions and tests.
