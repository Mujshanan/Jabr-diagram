import './square-gfx-block.js';

import { BlockViewExtension, type ExtensionType } from '@blocksuite/block-std';
import { literal } from 'lit/static-html.js';

export const SquareBlockSpec: ExtensionType[] = [
  BlockViewExtension('jabr:square', literal`jabr-square-gfx`),
];
