import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { SquareBlockModel, SquareBlockProps } from '../blocks/square/square-model.js';

/** Host-owned inspector: selection and document updates are supplied by the host. */
@customElement('jabr-properties-panel')
export class JabrPropertiesPanel extends LitElement {
  static styles = css`
    :host{display:block;color:var(--jabr-panel-text,#20242b);font:13px/1.4 system-ui,sans-serif}
    *{box-sizing:border-box}.panel{display:grid;gap:14px;padding:14px}
    h2{margin:0;font-size:13px;font-weight:650}.section{display:grid;gap:9px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    label{display:grid;gap:4px;color:var(--jabr-panel-muted,#737b87);font-size:11px}
    input{width:100%;min-width:0;border:1px solid var(--jabr-panel-border,#d8dce3);border-radius:5px;padding:6px 7px;background:var(--jabr-panel-input,#fff);color:inherit;font:inherit}
    input[type=color]{height:31px;padding:2px}.muted,.empty{color:var(--jabr-panel-muted,#737b87)}
    .identity{display:flex;justify-content:space-between;gap:8px}.tag{font-size:10px;color:var(--jabr-panel-muted,#737b87)}
  `;
  @property({attribute:false}) model: SquareBlockModel | null = null;
  @property({attribute:false}) onUpdate: ((patch: Partial<SquareBlockProps>)=>void) | undefined = undefined;

  private geometry(): [number,number,number,number] {
    try { const v: unknown = JSON.parse(this.model?.xywh ?? '[0,0,160,160]');
      if(Array.isArray(v)&&v.length===4&&v.every(Number.isFinite)) return v as [number,number,number,number];
    } catch { /* fall through */ }
    return [0,0,160,160];
  }
  private setGeometry(i:number,v:number) { const next=this.geometry(); next[i]=v; this.onUpdate?.({xywh:JSON.stringify(next)} as Partial<SquareBlockProps>); }
  private number(label:string,value:number,change:(v:number)=>void) {
    return html`<label>${label}<input type="number" .value=${String(value)} @change=${(e:Event)=>{const v=Number((e.currentTarget as HTMLInputElement).value);if(Number.isFinite(v))change(v)}}></label>`;
  }
  private color(value:string,fallback:string) { return /^#[0-9a-f]{6}$/i.test(value)?value:fallback; }
  override render() {
    const m=this.model;
    if(!m) return html`<div class="panel"><div class="identity"><h2>Properties</h2></div><div class="empty" style="padding:8px 0">Select a Jabr square to inspect its properties.</div></div>`;
    const [x,y,w,h]=this.geometry();
    return html`<div class="panel">
      <div class="identity"><h2>Properties</h2><span class="tag">jabr:square</span></div>
      <section class="section"><h2>Transform</h2><div class="grid">
        ${this.number('X',x,v=>this.setGeometry(0,v))}${this.number('Y',y,v=>this.setGeometry(1,v))}
        ${this.number('Width',w,v=>this.setGeometry(2,Math.max(1,v)))}${this.number('Height',h,v=>this.setGeometry(3,Math.max(1,v)))}
        ${this.number('Rotation',m.rotate,v=>this.onUpdate?.({rotate:v}))}
      </div></section>
      <section class="section"><h2>Appearance</h2><div class="grid">
        <label>Fill<input type="color" .value=${this.color(m.fill,'#e8f1ff')} @input=${(e:Event)=>this.onUpdate?.({fill:(e.currentTarget as HTMLInputElement).value})}></label>
        <label>Stroke<input type="color" .value=${this.color(m.stroke,'#2563eb')} @input=${(e:Event)=>this.onUpdate?.({stroke:(e.currentTarget as HTMLInputElement).value})}></label>
        ${this.number('Stroke width',m.strokeWidth,v=>this.onUpdate?.({strokeWidth:Math.max(0,v)}))}
      </div></section>
      <section class="section"><h2>Internal point</h2><div class="grid">
        ${this.number('Handle X',m.handleX,v=>this.onUpdate?.({handleX:Math.min(99,Math.max(1,v))}))}
        ${this.number('Handle Y',m.handleY,v=>this.onUpdate?.({handleY:Math.min(99,Math.max(1,v))}))}
      </div></section>
      <p class="muted">Edits are committed by the host through BlockSuite's document update API.</p>
    </div>`;
  }
}

export interface JabrLayerItem {
  id:string; label:string; flavour:string; depth?:number; selected?:boolean;
  kind?:'surface'|'group'|'element';
}

/** Read-only layer hierarchy; the host supplies rows and handles selection. */
@customElement('jabr-layers-panel')
export class JabrLayersPanel extends LitElement {
  static styles = css`
    :host{display:block;color:var(--jabr-panel-text,#20242b);font:13px/1.4 system-ui,sans-serif}
    *{box-sizing:border-box}.panel{padding:14px 8px}h2{margin:0 6px 12px;font-size:13px;font-weight:650}
    .tree{display:grid;gap:2px}button{display:flex;align-items:center;gap:8px;width:100%;min-width:0;border:0;border-radius:5px;padding:7px 8px;background:transparent;color:inherit;text-align:left;font:inherit;cursor:pointer}
    button:hover{background:var(--jabr-panel-hover,#f0f2f5)}button[aria-current=true]{background:var(--jabr-panel-selected,#e8efff);color:var(--jabr-panel-accent,#2459bd)}
    .glyph{width:15px;color:var(--jabr-panel-muted,#737b87);text-align:center}.name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .type{margin-left:auto;color:var(--jabr-panel-muted,#8a919c);font-size:10px}.empty{padding:8px;color:var(--jabr-panel-muted,#737b87)}
  `;
  @property({attribute:false}) items:JabrLayerItem[]=[];
  @property({attribute:false}) onSelect:((id:string)=>void)|undefined=undefined;
  override render() {
    return html`<div class="panel"><h2>Layers</h2><div class="tree">
      ${this.items.length?this.items.map(item=>html`<button type="button" aria-current=${item.selected?'true':'false'}
        style=${`padding-left:${8+(item.depth??0)*16}px`} @click=${()=>this.onSelect?.(item.id)}>
        <span class="glyph">${item.kind==='surface'?'▱':item.kind==='group'?'▾':'◇'}</span>
        <span class="name">${item.label}</span><span class="type">${item.flavour}</span>
      </button>`):html`<div class="empty">No diagram elements yet.</div>`}
    </div></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'jabr-properties-panel':JabrPropertiesPanel;
    'jabr-layers-panel':JabrLayersPanel;
  }
}
