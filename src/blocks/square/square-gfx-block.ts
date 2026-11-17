import type { SquareBlockModel } from './square-model.js';

import { GfxBlockComponent } from '@blocksuite/block-std';
import { css, html } from 'lit';

export class SquareGfxBlockComponent extends GfxBlockComponent<SquareBlockModel> {
  static override styles = css`
    :host {
      display: block;
      overflow: visible;
      user-select: none;
    }

    svg {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
    }

    .square {
      vector-effect: non-scaling-stroke;
      transition: fill 100ms ease, stroke 100ms ease;
    }

    :host(:hover) .square {
      filter: brightness(0.98);
    }
  `;

  override renderGfxBlock() {
    const { fill, stroke, strokeWidth } = this.model;

    return html`
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Jabr square drawing"
      >
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
      </svg>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jabr-square-gfx': SquareGfxBlockComponent;
  }
}
