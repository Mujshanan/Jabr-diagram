import type {
  GfxCommonBlockProps,
  GfxElementGeometry,
} from '@blocksuite/block-std/gfx';

import { GfxCompatible } from '@blocksuite/block-std/gfx';
import {
  BlockModel,
  defineBlockSchema,
} from '@blocksuite/store';

export type SquareBlockProps = GfxCommonBlockProps & {
  fill: string;
  stroke: string;
  strokeWidth: number;
  handlePoint: [number, number];
};

export const SquareBlockSchema = defineBlockSchema({
  flavour: 'jabr:square',
  props: (): SquareBlockProps => ({
    xywh: '[0,0,160,160]',
    index: 'a0',
    lockedBySelf: false,
    rotate: 0,
    scale: 1,
    fill: 'var(--jabr-draw-square-fill)',
    stroke: 'var(--jabr-draw-square-stroke)',
    strokeWidth: 2,
    handlePoint: [50, 50],
  }),
  metadata: {
    version: 1,
    role: 'content',
    parent: ['affine:surface'],
    children: [],
  },
  toModel: () => new SquareBlockModel(),
});


export class SquareBlockModel
  extends GfxCompatible<SquareBlockProps>(BlockModel)
  implements GfxElementGeometry {}

declare global {
  namespace BlockSuite {
    interface BlockModels {
      'jabr:square': SquareBlockModel;
    }

    interface EdgelessBlockModelMap {
      'jabr:square': SquareBlockModel;
    }
  }
}
