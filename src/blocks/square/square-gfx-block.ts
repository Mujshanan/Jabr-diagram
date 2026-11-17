import type { SquareBlockModel } from './square-model.js';

import { GfxBlockComponent } from '@blocksuite/block-std';
import { css, svg } from 'lit';
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

    jabr-square-gfx .jabr-square-handle {
      fill: var(--jabr-draw-square-handle);
      stroke: Canvas;
      stroke-width: 1.5;
      vector-effect: non-scaling-stroke;
      cursor: grab;
    }

    jabr-square-gfx .jabr-square-handle:active {
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
  private _editing = false;

  @state()
  private _draft: SquarePoint = { x: 50, y: 50 };

  @state()
  private _rotationPreview: number | null = null;

  private _rotationGesture: {
    pointerId: number;
    center: SquarePoint;
    startAngle: number;
    initialRotation: number;
  } | null = null;

  private _activePointerId: number | null = null;

  private _rotationEventRoot: Document | ShadowRoot | null = null;

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
    // Listen on the component's tree root rather than document: the editor
    // may host the Edgeless surface in a shadow tree, and these pointer events
    // must be observed inside that same tree.
    const root = this.getRootNode();
    this._rotationEventRoot =
      root instanceof Document || root instanceof ShadowRoot ? root : this.ownerDocument;
    this._rotationEventRoot.addEventListener('pointerdown', this._onRotationPointerDown as EventListener, true);
    this._rotationEventRoot.addEventListener('pointermove', this._onRotationPointerMove as EventListener, true);
    this._rotationEventRoot.addEventListener('pointerup', this._onRotationPointerUp as EventListener, true);
    this._rotationEventRoot.addEventListener('pointercancel', this._onRotationPointerCancel as EventListener, true);
  }

  override disconnectedCallback() {
    this._exitEditMode();
    this._clearRotationGesture();
    this.removeEventListener('keydown', this._onKeyDown);
    this._rotationEventRoot?.removeEventListener('pointerdown', this._onRotationPointerDown as EventListener, true);
    this._rotationEventRoot?.removeEventListener('pointermove', this._onRotationPointerMove as EventListener, true);
    this._rotationEventRoot?.removeEventListener('pointerup', this._onRotationPointerUp as EventListener, true);
    this._rotationEventRoot?.removeEventListener('pointercancel', this._onRotationPointerCancel as EventListener, true);
    this._rotationEventRoot = null;
    super.disconnectedCallback();
  }

  private _onRotationPointerDown = (event: PointerEvent) => {
    const path = event.composedPath();
    console.log('JABR_ROTATION_POINTERDOWN_CAPTURE', {
      modelId: this.model.id,
      targetTag: (event.target as Element | null)?.tagName ?? null,
      composed: event.composed,
      path: path.filter(node => node instanceof Element).map(node => {
        const element = node as Element;
        return { tag: element.tagName, className: element.getAttribute('class') };
      }).slice(0, 12),
    });
    if (this._editing || event.button !== 0 || this._rotationGesture) return;

    // The selected-rect widget lives inside the editor's shadow tree.
    // At document capture phase event.target is retargeted to the host, so
    // inspect composedPath() to find the actual rotate handle.
    const isRotateHandle = event.composedPath().some(
      target => target instanceof Element && target.classList.contains('rotate')
    );
    if (!isRotateHandle) return;

    const selections = this.gfx.selection.selectedElements;
    if (selections.length !== 1 || selections[0]?.id !== this.model.id) return;

    const [x, y, width, height] = JSON.parse(this.model.xywh) as number[];
    const center = { x: x + width / 2, y: y + height / 2 };
    const [pointX, pointY] = this.gfx.viewport.toModelCoordFromClientCoord([
      event.clientX,
      event.clientY,
    ]);

    this._rotationGesture = {
      pointerId: event.pointerId,
      center,
      startAngle: Math.atan2(pointY - center.y, pointX - center.x),
      initialRotation: this.model.rotate,
    };
    this._rotationPreview = this.model.rotate;
  };

  private _rotationFromPointerEvent(event: PointerEvent) {
    const gesture = this._rotationGesture;
    if (!gesture) return null;

    const [pointX, pointY] = this.gfx.viewport.toModelCoordFromClientCoord([
      event.clientX,
      event.clientY,
    ]);
    const angle = Math.atan2(
      pointY - gesture.center.y,
      pointX - gesture.center.x
    );
    let delta = angle - gesture.startAngle;
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;

    return gesture.initialRotation + (delta * 180) / Math.PI;
  }

  private _onRotationPointerMove = (event: PointerEvent) => {
    if (this._rotationGesture?.pointerId !== event.pointerId) return;
    const rotation = this._rotationFromPointerEvent(event);
    if (rotation !== null) this._rotationPreview = rotation;
  };

  private _onRotationPointerUp = (event: PointerEvent) => {
    if (this._rotationGesture?.pointerId !== event.pointerId) return;
    const rotation = this._rotationFromPointerEvent(event);
    const currentRotation = this.model.rotate;
    this._clearRotationGesture();

    // Commit once at pointerup. BlockSuite's own pointerup listener runs after
    // this capture listener and can close its history stash for the same drag.
    if (rotation !== null && Math.abs(rotation - currentRotation) > 0.001) {
      this.doc.updateBlock(this.model, { rotate: rotation });
    }
  };

  private _onRotationPointerCancel = (event: PointerEvent) => {
    if (this._rotationGesture?.pointerId !== event.pointerId) return;
    this._clearRotationGesture();
  };

  private _clearRotationGesture() {
    this._rotationGesture = null;
    this._rotationPreview = null;
  }

  private _enterEditMode() {
    if (this._editing) return;
    this._draft = {
      x: this.model.handlePoint[0],
      y: this.model.handlePoint[1],
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
      next.x !== this.model.handlePoint[0] ||
      next.y !== this.model.handlePoint[1]
    ) {
      // One persistent Yjs update per completed drag, never per pointermove.
      // Keep the point as one schema property so BlockSuite emits one
      // property update and the drag is represented by one atomic change.
      this.doc.updateBlock(this.model, {
        handlePoint: [next.x, next.y],
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
      x: this.model.handlePoint[0],
      y: this.model.handlePoint[1],
    };
  };

  private _onLostPointerCapture = (event: PointerEvent) => {
    if (this._activePointerId !== event.pointerId) return;
    this._activePointerId = null;
    this._draft = {
      x: this.model.handlePoint[0],
      y: this.model.handlePoint[1],
    };
  };

  override renderGfxBlock() {
    const { fill, stroke, strokeWidth, rotate } = this.model;
    const visualRotation = this._rotationPreview ?? rotate;
    const point = this._editing
      ? this._draft
      : { x: this.model.handlePoint[0], y: this.model.handlePoint[1] };

    return svg`
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
        <g transform="rotate(${visualRotation} 50 50)">
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
            ? svg`
                <rect
                  class="edit-outline"
                  x="1"
                  y="1"
                  width="98"
                  height="98"
                ></rect>
                <circle
                  class="jabr-square-handle"
                  data-jabr-handle
                  cx=${point.x}
                  cy=${point.y}
                  r="4"
                ></circle>
                <text class="hint" x="3" y="7">Drag point · Esc to finish</text>
              `
            : svg`
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
