import { AffineSchemas, EdgelessRootService } from '@blocksuite/blocks';
import { effects as blocksEffects } from '@blocksuite/blocks/effects';
import { AffineEditorContainer, effects as presetsEffects } from '@blocksuite/presets';
import { effects as presetEffects } from '@blocksuite/presets/effects';
import { Schema, DocCollection, Text } from '@blocksuite/store';
import { html, render } from 'lit';

import { SquareBlockSchema, SquareBlockSpec, type SquareBlockModel } from '../src/blocks/square/index.js';
import '../src/panels/index.js';
import type { JabrLayerItem, JabrPropertiesPanel, JabrLayersPanel } from '../src/panels/editor-panels.js';

import './styles.css';

blocksEffects();
presetsEffects();
presetEffects();

const schema = new Schema().register([...AffineSchemas, SquareBlockSchema]);
const collection = new DocCollection({ schema });
collection.meta.initialize();
const doc = collection.createDoc();

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app mount element');

const shell = document.createElement('main');
shell.className = 'workspace';
shell.innerHTML = `
  <header class="topbar">
    <div class="brand"><span class="brand-mark">J</span><div><strong>Jabr Draw</strong><small>BlockSuite integration host</small></div></div>
    <div class="toolbar">
      <span class="mode-label">EDGELESS TEST ENVIRONMENT</span>
      <button id="add-square" type="button">＋ Add square</button>
      <button id="fit-view" type="button" class="quiet">Fit view</button>
    </div>
  </header>
  <section class="editor-layout">
    <aside class="side-panel layers-panel"><jabr-layers-panel></jabr-layers-panel></aside>
    <section class="canvas-area"><div class="canvas-label">INFINITE CANVAS · BLOCKSUITE 0.19.5</div><div id="editor-mount"></div></section>
    <aside class="side-panel properties-panel"><jabr-properties-panel></jabr-properties-panel></aside>
  </section>
  <footer class="statusbar"><span id="status">Preparing document…</span><span>Jabr Draw prototype · Edgeless only</span></footer>
`;
app.replaceChildren(shell);

const editor = new AffineEditorContainer();
editor.className = 'edgeless-editor-container';
editor.mode = 'edgeless';
editor.edgelessSpecs = [...editor.edgelessSpecs, ...SquareBlockSpec];

const editorMount = shell.querySelector<HTMLDivElement>('#editor-mount')!;
editorMount.append(editor);

const properties = shell.querySelector<JabrPropertiesPanel>('jabr-properties-panel')!;
const layers = shell.querySelector<JabrLayersPanel>('jabr-layers-panel')!;
const status = shell.querySelector<HTMLSpanElement>('#status')!;

await doc.load(() => {
  const pageId = doc.addBlock('affine:page', { title: new Text('Jabr Draw test surface') });
  const surfaceId = doc.addBlock('affine:surface', {}, pageId);
  doc.addBlock('jabr:square', { xywh: '[80,80,150,150]', fill: '#e8f1ff', stroke: '#2563eb' }, surfaceId);
  doc.addBlock('jabr:square', { xywh: '[280,130,150,150]', fill: '#fff1e6', stroke: '#c66a27', rotate: 12 }, surfaceId);
  doc.addBlock('jabr:square', { xywh: '[500,70,150,150]', fill: '#e9f7ef', stroke: '#25845a', rotate: -8 }, surfaceId);
});
doc.resetHistory();
editor.doc = doc;
await editor.updateComplete;

const root = editor.std.get(EdgelessRootService);
const refreshPanels = () => {
  const squares = root.blocks.filter((model): model is SquareBlockModel => model.flavour === 'jabr:square');
  const selected = root.selection.selectedElements.find((model): model is SquareBlockModel => model.flavour === 'jabr:square') ?? null;

  properties.model = selected;
  properties.onUpdate = patch => {
    if (!selected) return;
    doc.updateBlock(selected, patch);
  };

  const rows: JabrLayerItem[] = [
    { id: root.surface.id, label: 'Surface', flavour: 'affine:surface', depth: 0, kind: 'surface' },
    ...squares.map((model, index) => ({
      id: model.id,
      label: `Square ${index + 1}`,
      flavour: model.flavour,
      depth: 1,
      selected: selected?.id === model.id,
      kind: 'element' as const,
    })),
  ];
  layers.items = rows;
  layers.onSelect = id => {
    if (id === root.surface.id) root.selection.clear();
    else root.selection.set({ elements: [id], editing: false });
  };
  properties.requestUpdate();
  layers.requestUpdate();
  status.textContent = selected ? `Selected ${selected.id.slice(0, 8)} · ${squares.length} squares` : `${squares.length} squares · nothing selected`;
};

root.selection.slots.updated.subscribe(refreshPanels);
doc.slots.blockUpdated.subscribe(refreshPanels);
refreshPanels();

shell.querySelector<HTMLButtonElement>('#add-square')!.addEventListener('click', () => {
  const count = root.blocks.filter(model => model.flavour === 'jabr:square').length;
  const id = root.addBlock('jabr:square', {
    xywh: `[${100 + count * 38},${280 + count * 28},150,150]`,
    fill: '#e8f1ff',
    stroke: '#2563eb',
  }, root.surface);
  root.selection.set({ elements: [id], editing: false });
});

shell.querySelector<HTMLButtonElement>('#fit-view')!.addEventListener('click', () => root.zoomToFit());

declare global {
  interface Window {
    __jabrHost?: { doc: typeof doc; editor: AffineEditorContainer; root: typeof root };
  }
}
window.__jabrHost = { doc, editor, root };

render(html`<span></span>`, shell.querySelector('.canvas-label')!);
status.textContent = 'Ready · select a square, then double-click its internal point to edit';
