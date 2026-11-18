import type { DiagramDocument, RectangleElement } from '../../model/diagram-document.js';
import type { SquareBlockModel } from './square-model.js';

/** Structural snapshot of the persisted jabr:square BlockSuite properties. */
export type SquareGfxSnapshot = {
  id: string; xywh: string; index: string; lockedBySelf: boolean; rotate: number; scale: number;
  fill: string; stroke: string; strokeWidth: number; handlePoint: [number, number];
};
const META = 'jabr.square';
function rotationTranslation(cx:number,cy:number,degrees:number){const a=degrees*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return {x:cx-(cx*c-cy*s),y:cy-(cx*s+cy*c)};}
function readBounds(xywh:string){const v=JSON.parse(xywh);if(!Array.isArray(v)||v.length!==4||!v.every(Number.isFinite))throw new Error('Invalid Gfx xywh');const [x,y,width,height]=v as number[];if(width<0||height<0)throw new Error('Gfx dimensions must be non-negative');return {x,y,width,height};}
/** Converts Gfx's center-origin rotation into the document model's origin-based affine transform. */
export function squareGfxToDocument(square:SquareGfxSnapshot):DiagramDocument{
 const bounds=readBounds(square.xywh),cx=bounds.x+bounds.width/2,cy=bounds.y+bounds.height/2;
 const translation=rotationTranslation(cx,cy,square.rotate);
 const element:RectangleElement={id:square.id,kind:'rectangle',bounds,transform:{translateX:translation.x,translateY:translation.y,rotationDegrees:square.rotate,scaleX:1,scaleY:1},style:{fill:square.fill,stroke:square.stroke,strokeWidth:square.strokeWidth},extensions:{[META]:{index:square.index,lockedBySelf:square.lockedBySelf,scale:square.scale,handlePoint:[...square.handlePoint]}}};
 return {schemaVersion:1,id:'diagram:'+square.id,coordinateSystem:{unit:'gfx-model',origin:'top-left',yAxis:'down'},elements:[element]};
}
/** Reverse adapter. Rejects documents that cannot be represented by the current square block. */
export function documentToSquareGfx(document:DiagramDocument):SquareGfxSnapshot{
 if(document.schemaVersion!==1||document.elements.length!==1)throw new Error('Square adapter requires one v1 element');
 const element=document.elements[0];if(!element||element.kind!=='rectangle')throw new Error('Square adapter requires a rectangle');
 const meta=element.extensions?.[META] as {index?:unknown;lockedBySelf?:unknown;scale?:unknown;handlePoint?:unknown}|undefined;
 if(!meta||typeof meta.index!=='string'||typeof meta.lockedBySelf!=='boolean'||typeof meta.scale!=='number'||!Array.isArray(meta.handlePoint)||meta.handlePoint.length!==2||!meta.handlePoint.every(Number.isFinite))throw new Error('Missing jabr.square adapter metadata');
 const t=element.transform;const rotate=t?.rotationDegrees??0;const cx=element.bounds.x+element.bounds.width/2,cy=element.bounds.y+element.bounds.height/2;const expected=rotationTranslation(cx,cy,rotate);
 if(t&& (Math.abs(t.scaleX-1)>1e-9||Math.abs(t.scaleY-1)>1e-9||Math.abs(t.translateX-expected.x)>1e-7||Math.abs(t.translateY-expected.y)>1e-7))throw new Error('Transform is not representable by Gfx square rotation');
 return {id:element.id,xywh:JSON.stringify([element.bounds.x,element.bounds.y,element.bounds.width,element.bounds.height]),index:meta.index,lockedBySelf:meta.lockedBySelf,rotate,scale:meta.scale,fill:element.style?.fill??'none',stroke:element.style?.stroke??'none',strokeWidth:element.style?.strokeWidth??0,handlePoint:[meta.handlePoint[0] as number,meta.handlePoint[1] as number]};
}

/** Adapter entry point typed against the actual BlockSuite model. */
export function squareBlockModelToDocument(model: SquareBlockModel): DiagramDocument {
  return squareGfxToDocument(model);
}
/** Returns persisted Gfx properties; the host remains responsible for applying them via doc.updateBlock. */
export function documentToSquareGfxProps(document: DiagramDocument): SquareGfxSnapshot {
  return documentToSquareGfx(document);
}
