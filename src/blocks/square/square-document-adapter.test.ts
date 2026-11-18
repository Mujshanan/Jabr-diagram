import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { documentToSquareGfx, squareGfxToDocument, type SquareGfxSnapshot } from './square-document-adapter.js';
import type { DiagramDocument } from '../../model/diagram-document.js';

const golden = JSON.parse(readFileSync(new URL('../../../tests/fixtures/square-v1.golden.json', import.meta.url), 'utf8')) as DiagramDocument;
const square: SquareGfxSnapshot = { id:'square-golden', xywh:'[20,30,160,120]', index:'a0', lockedBySelf:false, rotate:30, scale:1, fill:'#e8f1ff', stroke:'#2563eb', strokeWidth:2, handlePoint:[50,50] };

describe('square Gfx/document adapter', () => {
 it('matches the versioned golden document', () => { expect(squareGfxToDocument(square)).toEqual(golden); });
 it('round-trips the current square block properties without loss', () => { expect(documentToSquareGfx(squareGfxToDocument(square))).toEqual(square); });
 it('round-trips the golden fixture back to the square adapter shape', () => { expect(documentToSquareGfx(golden)).toEqual(square); });
 it('rejects affine transforms the current Gfx square cannot represent', () => { const changed=structuredClone(golden); (changed.elements[0] as any).transform.translateX += 1; expect(()=>documentToSquareGfx(changed)).toThrow(/not representable/); });
});
