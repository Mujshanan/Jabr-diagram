import type { SquareBlockModel } from './square-model.js';

import { GfxBlockComponent } from '@blocksuite/block-std';
import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';

import { toSquareModelPoint, type SquarePoint } from './square-geometry.js';

@customElement('jabr-square-gfx')
export class SquareGfxBlockComponent extends GfxBlockComponent<SquareBlockModel> {
  static override styles = css`
    /*
     * BlockSuite 0.19.5 GfxBlockComponent inherits ShadowlessElement.
     * Its styles may be injected into document.head, so every selector must
     * be explicitly scoped to this custom-element tag.
     */
    jabr-square-gfx {
      display: block;
      overflow: visible;
      user-select: none;
      --jabr-draw-square-fill: var(--affine-background-primary-color, #e8f1ff);
      --jabr-draw-square-stroke: var(--affine-primary-color, #2563eb);
      --jabr-draw-square-handle: var(--affine-primary-color, #1d4ed8);
      --jabr-draw-selection: var(--affine-primary-color, #2563eb);
    }

    jabr-square-gfx svg {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
      outline: none;
    }

    jabr-square-gfx svg.editing {
      touch-action: none;
    }

    jabr-square-gfx .square {
      vector-effect: non-scaling-stroke;
      transition: fill 100ms ease, stroke 100ms ease;
    }

    jabr-square-gfx .handle {
      fill: var(--jabr-draw-square-handle);
      stroke: Canvas;
      stroke-width: 1.5;
      vector-effect: non-scaling-stroke;
      cursor: grab;
    }

    jabr-square-gfx .handle:active {
      cursor: grabbing;
    }

    jabr-square-gfx .edit-outline {
      fill: none;
      stroke: var(--jabr-draw-selection);
      stroke-width: 1;
      stroke-dasharray: 3 2;
      vector-effect: non-scaling-stroke;
      pointer-events: none;
    }

    jabr-square-gfx .hint {
      fill: var(--affine-text-primary-color, currentColor);
      font: 4px sans-serif;
      opacity: 0.75;
      pointer-events: none;
    }
  `;

  @state()
  private accessor _editing = false;

  @state()
  private accessor _draft: SquarePoint = { x: 50, y: 50 };

  private _activePointerId: number | null = null;

  private readonly _onDocumentPointerDown = (event: PointerEvent) => {
    if (!event.composedPath().includes(this)) {
      this._exitEditMode();
    }
  };

  private readonly _onKeyDown = (event: KeyboardEvent) => {
    if (!this._editing) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this._exitEditMode();
      return;
    }

    // The SVG is the focused internal editor surface. Do not let destructive
    // editor shortcuts delete the complete Gfx block while it is being edited.
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  override connectedCallback() {
    super.connectedCallback();
    this.addEventListener('keydown', this._onKeyDown);
  }

  override disconnectedCallback() {
    this._exitEditMode();
    this.removeEventListener('keydown', this._onKeyDown);
    super.disconnectedCallback();
  }

  private _enterEditMode() {
    if (this._editing) return;
    this._draft = {
      x: this.model.handleX,
      y: this.model.handleY,
    };
    this._editing = true;
    document.addEventListener('pointerdown', this._onDocumentPointerDown, true);
  }

  private _exitEditMode() {
    if (!this._editing) return;
    this._editing = false;
    const activePointerId = this._activePointerId;
    this._activePointerId = null;

    // GfxBlockComponent is shadowless in BlockSuite 0.19.5; the SVG is a
    // light-DOM child, not a descendant of this.shadowRoot.
    const svg = this.querySelector('svg');
    if (
      activePointerId !== null &&
      svg?.hasPointerCapture(activePointerId)
    ) {
      svg.releasePointerCapture(activePointerId);
    }

    document.removeEventListener(
      'pointerdown',
      this._onDocumentPointerDown,
      true
    );
  }

  /**
   * Persist appearance changes through BlockSuite/Yjs so they survive reload
   * and are visible to collaborating clients.
   */
  updateAppearance(
    patch: Partial<Pick<SquareBlockModel, 'fill' | 'stroke' | 'strokeWidth'>>
  ) {
    this.doc.updateBlock(this.model, patch);
  }

  private _onDoubleClick = (event: MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    const svg = event.currentTarget;
    if (svg instanceof SVGSVGElement) svg.focus();
    this._enterEditMode();
  };

  private _onPointerDown = (event: PointerEvent) => {
    if (!this._editing) return;

    const target = event.target;
    if (!(target instanceof Element) || !target.closest('[data-jabr-handle]')) {
      event.stopPropagation();
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const svg = event.currentTarget;
    if (!(svg instanceof SVGSVGElement)) return;

    this._activePointerId = event.pointerId;
    svg.setPointerCapture(event.pointerId);
  };

  private _toSvgPoint(event: PointerEvent, svg: SVGSVGElement): SquarePoint | null {
    const screenMatrix = svg.getScreenCTM();
    if (!screenMatrix) return null;

    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;

    const local = point.matrixTransform(screenMatrix.inverse());
    return toSquareModelPoint(
      { x: local.x, y: local.y },
      this.model.rotate
    );
  }

  private _onPointerMove = (event: PointerEvent) => {
    if (!this._editing || this._activePointerId !== event.pointerId) return;

    event.preventDefault();
    event.stopPropagation();

    const svg = event.currentTarget;
    if (!(svg instanceof SVGSVGElement)) return;

    const point = this._toSvgPoint(event, svg);
    if (point) this._draft = point;
  };

  private _onPointerUp = (event: PointerEvent) => {
    if (this._activePointerId !== event.pointerId) return;

    event.preventDefault();
    event.stopPropagation();

    const svg = event.currentTarget;
    this._activePointerId = null;

    if (svg instanceof SVGSVGElement && svg.hasPointerCapture(event.pointerId)) {
      svg.releasePointerCapture(event.pointerId);
    }

    const finalPoint =
      svg instanceof SVGSVGElement ? this._toSvgPoint(event, svg) : null;
    const next = finalPoint ?? this._draft;
    this._draft = next;

    if (
      next.x !== this.model.handleX ||
      next.y !== this.model.handleY
    ) {
      // One persistent Yjs update per completed drag, never per pointermove.
      this.doc.updateBlock(this.model, {
        handleX: next.x,
        handleY: next.y,
      });
    }
  };

  private _onPointerCancel = (event: PointerEvent) => {
    if (this._activePointerId !== event.pointerId) return;

    event.preventDefault();
    event.stopPropagation();

    const svg = event.currentTarget;
    this._activePointerId = null;
    if (svg instanceof SVGSVGElement && svg.hasPointerCapture(event.pointerId)) {
      svg.releasePointerCapture(event.pointerId);
    }
    this._draft = {
      x: this.model.handleX,
      y: this.model.handleY,
    };
  };

  private _onLostPointerCapture = (event: PointerEvent) => {
    if (this._activePointerId !== event.pointerId) return;
    this._activePointerId = null;
    this._draft = {
      x: this.model.handleX,
      y: this.model.handleY,
    };
  };

  override renderGfxBlock() {
    const { fill, stroke, strokeWidth, rotate } = this.model;
    const point = this._editing
      ? this._draft
      : { x: this.model.handleX, y: this.model.handleY };

    return html`
      <svg
        class=${this._editing ? 'editing' : ''}
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Jabr interactive square"
        tabindex="0"
        @dblclick=${this._onDoubleClick}
        @pointerdown=${this._onPointerDown}
        @pointermove=${this._onPointerMove}
        @pointerup=${this._onPointerUp}
        @pointercancel=${this._onPointerCancel}
        @lostpointercapture=${this._onLostPointerCapture}
      >
        <g transform="rotate(${rotate} 50 50)">
          <rect
            class="square"
            x="1"
            y="1"
            width="98"
            height="98"
            rx="0"
            fill=${fill}
            stroke=${stroke}
            stroke-width=${strokeWidth}
          ></rect>
          ${this._editing
            ? html`
                <rect
                  class="edit-outline"
                  x="1"
                  y="1"
                  width="98"
                  height="98"
                ></rect>
                <circle
                  class="handle"
                  data-jabr-handle
                  cx=${point.x}
                  cy=${point.y}
                  r="4"
                ></circle>
                <text class="hint" x="3" y="7">Drag point · Esc to finish</text>
              `
            : html`
                <circle
                  cx=${point.x}
                  cy=${point.y}
                  r="2"
                  fill="var(--jabr-draw-square-handle)"
                ></circle>
              `}
        </g>
      </svg>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jabr-square-gfx': SquareGfxBlockComponent;
  }
}
