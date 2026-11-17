import type {
  GfxCommonBlockProps,
  GfxElementGeometry,
} from '@blocksuite/block-std/gfx';

import { GfxCompatible } from '@blocksuite/block-std/gfx';
import { BlockModel, BlockSchemaExtension, defineBlockSchema } from '@blocksuite/store';

export type SquareBlockProps = GfxCommonBlockProps & {
  fill: string;
  stroke: string;
  strokeWidth: number;
};

export const SquareBlockSchema = defineBlockSchema({
  flavour: 'jabr:square',
  props: (): SquareBlockProps => ({
    xywh: '[0,0,160,160]',
    index: 'a0',
    lockedBySelf: false,
    rotate: 0,
    scale: 1,
    fill: '#e8f1ff',
    stroke: '#2563eb',
    strokeWidth: 2,
  }),
  metadata: {
    version: 1,
    role: 'hub',
    parent: ['affine:surface'],
    children: [],
  },
  toModel: () => new SquareBlockModel(),
});

export const SquareBlockSchemaExtension = BlockSchemaExtension(SquareBlockSchema);

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
