import type { SquareBlockModel } from './square-model.js';

import { GfxBlockComponent } from '@blocksuite/block-std';
import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';

type Point = { x: number; y: number };

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

@customElement('jabr-square-gfx')
export class SquareGfxBlockComponent extends GfxBlockComponent<SquareBlockModel> {
  static override styles = css`
    :host {
      display: block;
      overflow: visible;
      user-select: none;
      --jabr-draw-square-fill: var(--affine-background-primary-color, #e8f1ff);
      --jabr-draw-square-stroke: var(--affine-primary-color, #2563eb);
      --jabr-draw-square-handle: var(--affine-primary-color, #1d4ed8);
      --jabr-draw-selection: var(--affine-primary-color, #2563eb);
    }

    svg {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
      outline: none;
    }

    svg.editing {
      touch-action: none;
    }

    .square {
      vector-effect: non-scaling-stroke;
      transition: fill 100ms ease, stroke 100ms ease;
    }

    .handle {
      fill: var(--jabr-draw-square-handle);
      stroke: Canvas;
      stroke-width: 1.5;
      vector-effect: non-scaling-stroke;
      cursor: grab;
    }

    .handle:active {
      cursor: grabbing;
    }

    .edit-outline {
      fill: none;
      stroke: var(--jabr-draw-selection);
      stroke-width: 1;
      stroke-dasharray: 3 2;
      vector-effect: non-scaling-stroke;
      pointer-events: none;
    }

    .hint {
      fill: var(--affine-text-primary-color, currentColor);
      font: 4px sans-serif;
      opacity: 0.75;
      pointer-events: none;
    }
  `;

  @state()
  private accessor _editing = false;

  @state()
  private accessor _draft: Point = { x: 50, y: 50 };

  private _activePointerId: number | null = null;

  private readonly _onDocumentPointerDown = (event: PointerEvent) => {
    if (!event.composedPath().includes(this)) {
      this._exitEditMode();
    }
  };

  private readonly _onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && this._editing) {
      event.preventDefault();
      event.stopPropagation();
      this._exitEditMode();
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
    const svg = this.shadowRoot?.querySelector('svg');
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

  private _toSvgPoint(event: PointerEvent, svg: SVGSVGElement): Point | null {
    const screenMatrix = svg.getScreenCTM();
    if (!screenMatrix) return null;

    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;

    const local = point.matrixTransform(screenMatrix.inverse());
    return {
      x: clamp(local.x, 1, 99),
      y: clamp(local.y, 1, 99),
    };
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

    event.stopPropagation();
    this._activePointerId = null;
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
        class=${this._editing ? "editing" : ""}
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
