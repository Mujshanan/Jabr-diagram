import { AffineSchemas, EdgelessRootService, SurfaceBlockSchema } from '@blocksuite/blocks';
import { effects as blocksEffects } from '@blocksuite/blocks/effects';
import { AffineEditorContainer } from '@blocksuite/presets';
import { effects as presetEffects } from '@blocksuite/presets/effects';
import { DocCollection, Job, Schema, Text, type Doc } from '@blocksuite/store';

import {
  SquareBlockSchema,
  SquareBlockSpec,
  type SquareBlockModel,
} from '../src/blocks/square/index.js';
import '../src/panels/index.js';
import type {
  JabrLayerItem,
  JabrLayersPanel,
  JabrPropertiesPanel,
} from '../src/panels/editor-panels.js';

import './styles.css';

blocksEffects();
presetEffects();

const STORAGE_KEY = 'jabr-draw-edgeless-phase1';
const extendedSurfaceSchema = {
  ...SurfaceBlockSchema,
  metadata: {
    ...SurfaceBlockSchema.metadata,
    children: [...SurfaceBlockSchema.metadata.children, 'jabr:square'],
  },
};
const schema = new Schema().register([
  ...AffineSchemas.filter(item => item.flavour !== 'affine:surface'),
  extendedSurfaceSchema,
  SquareBlockSchema,
]);
const collection = new DocCollection({ schema });
collection.meta.initialize();
const job = new Job({ collection });

let restoredDoc: Doc | undefined;
const savedSnapshot = localStorage.getItem(STORAGE_KEY);
if (savedSnapshot) {
  try {
    restoredDoc = await job.snapshotToDoc(JSON.parse(savedSnapshot));
  } catch (error) {
    console.warn('Could not restore the saved Jabr Draw test document; starting a fresh one.', error);
    localStorage.removeItem(STORAGE_KEY);
  }
}

if (!restoredDoc) {
  const freshDoc = collection.createDoc();
  await freshDoc.load(() => {
    const pageId = freshDoc.addBlock('affine:page', {
      title: new Text('Jabr Draw test surface'),
    });
    const surfaceId = freshDoc.addBlock('affine:surface', {}, pageId);
  });
  restoredDoc = freshDoc;
}

if (!restoredDoc) throw new Error('Failed to initialize the Jabr Draw test document.');
const doc: Doc = restoredDoc;
const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app mount element');

const shell = document.createElement('main');
shell.className = 'workspace';
shell.innerHTML = `
  <header class="topbar">
    <div class="brand"><span class="brand-mark">J</span><div><strong>Jabr Draw</strong><small>BlockSuite integration host</small></div></div>
    <div class="toolbar">
      <span class="mode-label">EDGELESS TEST ENVIRONMENT</span>
      <button id="undo" type="button" class="quiet">Undo</button>
      <button id="redo" type="button" class="quiet">Redo</button>
      <button id="bring-forward" type="button" class="quiet">Bring forward</button>
      <button id="send-backward" type="button" class="quiet">Send backward</button>
      <button id="add-square" type="button">＋ Add square</button>
      <button id="fit-view" type="button" class="quiet">Fit view</button>
    </div>
  </header>
  <section class="editor-layout">
    <aside class="side-panel layers-panel"><jabr-layers-panel></jabr-layers-panel></aside>
    <section class="canvas-area"><div class="canvas-label">INFINITE CANVAS · BLOCKSUITE 0.19.5</div><div id="editor-mount"></div></section>
    <aside class="side-panel properties-panel"><jabr-properties-panel></jabr-properties-panel></aside>
  </section>
  <footer class="statusbar"><span id="status">Preparing document…</span><span>Local snapshot persistence · Jabr Draw prototype</span></footer>
`;
app.replaceChildren(shell);

const editor = new AffineEditorContainer();
editor.className = 'edgeless-editor-container';
editor.mode = 'edgeless';
editor.doc = doc;
editor.edgelessSpecs = [...editor.edgelessSpecs, ...SquareBlockSpec];

const editorMount = shell.querySelector<HTMLDivElement>('#editor-mount')!;
editorMount.append(editor);

const properties = shell.querySelector<JabrPropertiesPanel>('jabr-properties-panel')!;
const layers = shell.querySelector<JabrLayersPanel>('jabr-layers-panel')!;
const status = shell.querySelector<HTMLSpanElement>('#status')!;
const undoButton = shell.querySelector<HTMLButtonElement>('#undo')!;
const redoButton = shell.querySelector<HTMLButtonElement>('#redo')!;
const bringForwardButton = shell.querySelector<HTMLButtonElement>('#bring-forward')!;
const sendBackwardButton = shell.querySelector<HTMLButtonElement>('#send-backward')!;

await editor.updateComplete;
const root = editor.std.get(EdgelessRootService);

// Insert the sample Gfx blocks through the Edgeless layer service so each gets
// a unique layer index and is registered in the surface's Gfx layer manager.
const sampleIds: string[] = [];
if (!root.blocks.some(model => model.flavour === 'jabr:square')) {
  sampleIds.push(root.addBlock('jabr:square', {
    xywh: '[80,80,150,150]', fill: '#e8f1ff', stroke: '#2563eb',
  }, root.surface));
  sampleIds.push(root.addBlock('jabr:square', {
    xywh: '[280,130,150,150]', fill: '#fff1e6', stroke: '#c66a27', rotate: 12,
  }, root.surface));
  sampleIds.push(root.addBlock('jabr:square', {
    xywh: '[500,70,150,150]', fill: '#e9f7ef', stroke: '#25845a', rotate: -8,
  }, root.surface));
}
doc.resetHistory();

const updateHistoryControls = () => {
  undoButton.disabled = !doc.canUndo;
  redoButton.disabled = !doc.canRedo;
  const hasSelection = root.selection.selectedElements.length > 0;
  bringForwardButton.disabled = !hasSelection;
  sendBackwardButton.disabled = !hasSelection;
};

const refreshPanels = () => {
  const squares = root.blocks.filter(
    (model): model is SquareBlockModel => (doc.getBlockById(model.id) as unknown as { flavour?: string } | null)?.flavour === 'jabr:square'
  );
  const selectedId = root.selection.selectedIds[0];
  const selected = root.blocks.find(
    (model): model is SquareBlockModel =>
      model.id === selectedId && model.flavour === 'jabr:square'
  ) ?? null;

  properties.model = selected;
  properties.onUpdate = patch => {
    if (selected) doc.updateBlock(selected, patch);
  };

  const rows: JabrLayerItem[] = [
    {
      id: root.surface.id,
      label: 'Surface',
      flavour: 'affine:surface',
      depth: 0,
      kind: 'surface',
    },
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
  status.textContent = selected
    ? `Selected ${selected.id.slice(0, 8)} · ${squares.length} squares`
    : `${squares.length} squares · nothing selected`;
  updateHistoryControls();
};

let saveTimer: number | undefined;
const scheduleSnapshotSave = () => {
  if (saveTimer !== undefined) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(async () => {
    try {
      const snapshot = await job.docToSnapshot(doc);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      status.textContent = 'Saved locally · ' + new Date().toLocaleTimeString();
    } catch (error) {
      console.error('Failed to save the Jabr Draw test document.', error);
      status.textContent = 'Local save failed · see browser console';
    }
  }, 180);
};

root.selection.slots.updated.on(refreshPanels);
doc.slots.blockUpdated.on(() => {
  refreshPanels();
  scheduleSnapshotSave();
});
doc.slots.historyUpdated.on(updateHistoryControls);
refreshPanels();
updateHistoryControls();

shell.querySelector<HTMLButtonElement>('#undo')!.addEventListener('click', () => doc.undo());
shell.querySelector<HTMLButtonElement>('#redo')!.addEventListener('click', () => doc.redo());
bringForwardButton.addEventListener('click', () => {
  const selectedId = root.selection.selectedIds[0];
  const selected = root.blocks.find(model => model.id === selectedId);
  if (selected) root.reorderElement(selected, 'forward');
});
sendBackwardButton.addEventListener('click', () => {
  const selectedId = root.selection.selectedIds[0];
  const selected = root.blocks.find(model => model.id === selectedId);
  if (selected) root.reorderElement(selected, 'backward');
});

shell.querySelector<HTMLButtonElement>('#add-square')!.addEventListener('click', () => {
  const count = root.blocks.filter(model => (model as unknown as { flavour?: string }).flavour === 'jabr:square').length;
  const id = root.addBlock('jabr:square', {
    xywh: `[${100 + count * 38},${280 + count * 28},150,150]`,
    fill: '#e8f1ff',
    stroke: '#2563eb',
  }, root.surface);
  root.selection.set({ elements: [id], editing: false });
});

shell.querySelector<HTMLButtonElement>('#fit-view')!.addEventListener('click', () => {
  root.zoomToFit();
});

declare global {
  interface Window {
    __jabrHost?: {
      doc: Doc;
      editor: AffineEditorContainer;
      root: typeof root;
      sampleIds: string[];
    };
  }
}
window.__jabrHost = { doc, editor, root, sampleIds };
status.textContent = 'Ready · select a square, double-click its internal point to edit';
