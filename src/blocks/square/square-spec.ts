import './square-gfx-block.js';

import { BlockViewExtension, type ExtensionType } from '@blocksuite/block-std';
import { GfxViewInteractionExtension } from '@blocksuite/block-std/gfx';
import { literal } from 'lit/static-html.js';

export const SquareBlockSpec: ExtensionType[] = [
  GfxViewInteractionExtension('jabr:square', {
    // Preserve BlockSuite's default Gfx rotation behavior explicitly for this
    // custom block view. This keeps the block model's rotate/xywh properties
    // and undo history in sync with the selection-handle gesture.
    handleRotate: () => ({
      onRotateStart: context => context.default(context),
      onRotateMove: context => context.default(context),
      onRotateEnd: context => context.default(context),
    }),
  }),
  BlockViewExtension('jabr:square', literal`jabr-square-gfx`),
];
