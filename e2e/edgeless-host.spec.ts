import { expect, test } from '@playwright/test';

test('mounts the BlockSuite Edgeless host and the three starter squares', async ({ page }) => {
  await page.goto('/');
  const diagnostics = await page.evaluate(() => {
    const host = window.__jabrHost!;
    return {
      sampleIds: host.sampleIds,
      rootBlockIds: host.root.blocks.map(model => model.id),
      surfaceId: host.root.surface.id,
      models: host.sampleIds.map(id => {
        const model = host.doc.getBlockById(id);
        const parent = model ? host.doc.getParent(model) : null;
        return {
          id,
          flavour: model?.flavour ?? null,
          modelType: model?.constructor.name ?? null,
          parentFlavour: parent?.flavour ?? null,
          parentType: parent?.constructor.name ?? null,
        };
      }),
    };
  });
  console.log('JABR_EDGELESS_DIAGNOSTICS', JSON.stringify(diagnostics));
  await expect(page.locator('affine-editor-container')).toBeVisible();
  await expect(page.locator('jabr-square-gfx')).toHaveCount(3);
  await expect(page.getByText('Layers', { exact: true })).toBeVisible();
  await expect(page.getByText('Properties', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Square 1' })).toBeVisible();
});

test('selects a layer and persists property edits through the BlockSuite document', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Square 2' }).click();
  await expect(page.locator('jabr-properties-panel')).toContainText('jabr:square');

  const initial = await page.evaluate(() => {
    const host = window.__jabrHost;
    const selected = host?.root.selection.selectedElements[0];
    return selected ? { id: selected.id, fill: (selected as { fill?: string }).fill } : null;
  });
  expect(initial).not.toBeNull();

  await page.locator('jabr-properties-panel input[type="color"]').first().evaluate((node) => {
    const input = node as HTMLInputElement;
    input.value = '#123456';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect.poll(async () => page.evaluate(id => {
    const model = window.__jabrHost?.doc.getBlockById(id);
    return (model as { fill?: string } | null)?.fill ?? null;
  }, initial!.id)).toBe('#123456');

  await expect(page.locator('jabr-square-gfx')).toHaveCount(3);

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(async () => page.evaluate(id => {
    const model = window.__jabrHost?.doc.getBlockById(id) as unknown as { fill?: string } | null;
    return model?.fill ?? null;
  }, initial!.id)).toBe('#fff1e6');

  await page.getByRole('button', { name: 'Redo' }).click();
  await expect.poll(async () => page.evaluate(id => {
    const model = window.__jabrHost?.doc.getBlockById(id) as unknown as { fill?: string } | null;
    return model?.fill ?? null;
  }, initial!.id)).toBe('#123456');

  await expect(page.getByText(/Saved locally/)).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Square 2' }).click();
  await expect(page.locator('jabr-properties-panel input[type="color"]').first()).toHaveValue('#123456');
});

test('adds another Gfx square from the host toolbar', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add square' }).click();
  await expect(page.locator('jabr-square-gfx')).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'Square 4' })).toBeVisible();
});

test('internal point drag is one undoable edit at non-default zoom and rotation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Square 2' }).click();
  const block = page.locator('jabr-square-gfx').nth(1);
  const svg = block.locator('svg');

  await svg.evaluate(node => {
    node.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
  });
  await expect(svg).toHaveClass(/editing/);

  const blockId = await page.evaluate(() => window.__jabrHost?.root.selection.selectedIds[0] ?? null);
  expect(blockId).not.toBeNull();
  await page.evaluate(id => {
    const host = window.__jabrHost!;
    (window as Window & { __jabrUpdateCount?: number }).__jabrUpdateCount = 0;
    host.doc.slots.blockUpdated.on(payload => {
      if (payload.id === id && payload.type === 'update') {
        (window as Window & { __jabrUpdateCount?: number }).__jabrUpdateCount! += 1;
      }
    });
  }, blockId!);

  // Exercise the real Edgeless viewport zoom rather than a CSS-only scale.
  await page.evaluate(id => {
    const model = window.__jabrHost!.doc.getBlockById(id) as unknown as { xywh: string };
    const [x, y, width, height] = JSON.parse(model.xywh) as number[];
    const viewport = widget.gfx.viewport;
    const rootViewport = window.__jabrHost!.root.viewport;
    // Keep the selected square in the canvas area (not underneath the
    // inspector panel) while applying a real viewport zoom.
    viewport.setViewport(1.25, [x + width / 2, y + height / 2], false);
  }, blockId!);
  await expect.poll(async () => page.evaluate(() => window.__jabrHost!.root.zoom)).toBe(1.25);

  const before = await page.evaluate(id => {
    const model = window.__jabrHost?.doc.getBlockById(id) as unknown as {
      handlePoint: [number, number]; xywh: string; rotate: number;
    } | null;
    return model ? {
      x: model.handlePoint[0], y: model.handlePoint[1], xywh: model.xywh, rotate: model.rotate,
    } : null;
  }, blockId!);
  expect(before).not.toBeNull();
  expect(before!.rotate).toBe(12);

  const handle = block.locator('circle.jabr-square-handle');
  await expect(handle).toHaveCount(1);
  const bounds = await handle.boundingBox();
  expect(bounds).not.toBeNull();
  const startX = bounds!.x + bounds!.width / 2;
  const startY = bounds!.y + bounds!.height / 2;
  await handle.evaluate(node => {
    node.addEventListener('pointerdown', () => {
      (window as Window & { __jabrInternalPointerDown?: boolean }).__jabrInternalPointerDown = true;
    }, { once: true });
  });
  const targetX = startX + 24;
  const targetY = startY + 18;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  expect(await page.evaluate(() => (window as Window & { __jabrInternalPointerDown?: boolean }).__jabrInternalPointerDown ?? false)).toBe(true);
  await page.mouse.move(targetX, targetY, { steps: 5 });
  await page.mouse.up();

  await expect.poll(async () => page.evaluate(id => {
    const model = window.__jabrHost?.doc.getBlockById(id) as unknown as { handlePoint: [number, number] } | null;
    return model?.handlePoint[0] ?? null;
  }, blockId!)).not.toBe(before!.x);
  await expect.poll(async () => page.evaluate(id => {
    const model = window.__jabrHost?.doc.getBlockById(id) as unknown as { handlePoint: [number, number] } | null;
    return model?.handlePoint[1] ?? null;
  }, blockId!)).not.toBe(before!.y);

  // The SVG handle should remain under the pointer even after viewport zoom
  // and inverse rotation are applied.
  const movedHandleBounds = await handle.boundingBox();
  expect(movedHandleBounds).not.toBeNull();
  expect(Math.abs((movedHandleBounds!.x + movedHandleBounds!.width / 2) - targetX)).toBeLessThan(3);
  expect(Math.abs((movedHandleBounds!.y + movedHandleBounds!.height / 2) - targetY)).toBeLessThan(3);

  const after = await page.evaluate(id => {
    const model = window.__jabrHost?.doc.getBlockById(id) as unknown as {
      handlePoint: [number, number]; xywh: string;
    } | null;
    return model ? { x: model.handlePoint[0], y: model.handlePoint[1], xywh: model.xywh } : null;
  }, blockId!);
  expect(after).not.toBeNull();
  expect(after!.xywh).toBe(before!.xywh);

  // The point pair is one schema property, so one completed drag emits one
  // block update and is recorded as one undoable edit.
  await expect.poll(async () => page.evaluate(() =>
    (window as Window & { __jabrUpdateCount?: number }).__jabrUpdateCount ?? 0
  )).toBe(1);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(async () => page.evaluate(id => {
    const model = window.__jabrHost?.doc.getBlockById(id) as unknown as {
      handlePoint: [number, number];
    } | null;
    return model ? [model.handlePoint[0], model.handlePoint[1]] : null;
  }, blockId!)).toEqual([before!.x, before!.y]);

  await page.getByRole('button', { name: 'Redo' }).click();
  await expect.poll(async () => page.evaluate(id => {
    const model = window.__jabrHost?.doc.getBlockById(id) as unknown as {
      handlePoint: [number, number];
    } | null;
    return model ? [model.handlePoint[0], model.handlePoint[1]] : null;
  }, blockId!)).toEqual([after!.x, after!.y]);

  await page.keyboard.press('Escape');
  await expect(block.locator('circle.jabr-square-handle')).toHaveCount(0);
});

test('pointer cancellation discards an internal point drag without changing the document', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Square 1' }).click();
  const block = page.locator('jabr-square-gfx').first();
  const svg = block.locator('svg');

  await svg.evaluate(node => {
    node.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
  });
  await expect(svg).toHaveClass(/editing/);

  const blockId = await page.evaluate(() => window.__jabrHost?.root.selection.selectedIds[0] ?? null);
  expect(blockId).not.toBeNull();
  const before = await page.evaluate(id => {
    const model = window.__jabrHost?.doc.getBlockById(id) as unknown as {
      handlePoint: [number, number];
    } | null;
    return model ? [model.handlePoint[0], model.handlePoint[1]] : null;
  }, blockId!);

  const handle = block.locator('circle.jabr-square-handle');
  const bounds = await handle.boundingBox();
  expect(bounds).not.toBeNull();
  const startX = bounds!.x + bounds!.width / 2;
  const startY = bounds!.y + bounds!.height / 2;

  await svg.evaluate(node => {
    node.addEventListener('pointerdown', event => {
      (window as Window & { __jabrPointerId?: number }).__jabrPointerId = (event as PointerEvent).pointerId;
    }, { capture: true, once: true });
  });
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 30, startY + 20, { steps: 3 });

  const pointerId = await page.evaluate(() =>
    (window as Window & { __jabrPointerId?: number }).__jabrPointerId ?? null
  );
  expect(pointerId).not.toBeNull();

  // Deliver cancellation to the captured SVG surface; the component must
  // discard its local draft and release the active pointer.
  await svg.evaluate((node, id) => {
    node.dispatchEvent(new PointerEvent('pointercancel', {
      bubbles: true,
      cancelable: true,
      pointerId: id!,
    }));
  }, pointerId);
  await page.mouse.up();

  await expect.poll(async () => page.evaluate(id => {
    const model = window.__jabrHost?.doc.getBlockById(id) as unknown as {
      handlePoint: [number, number];
    } | null;
    return model ? [model.handlePoint[0], model.handlePoint[1]] : null;
  }, blockId!)).toEqual(before);

  const restoredHandle = await handle.boundingBox();
  expect(restoredHandle).not.toBeNull();
  expect(Math.abs((restoredHandle!.x + restoredHandle!.width / 2) - startX)).toBeLessThan(2);
  expect(Math.abs((restoredHandle!.y + restoredHandle!.height / 2) - startY)).toBeLessThan(2);

  await page.keyboard.press('Escape');
  await expect(handle).toHaveCount(0);
});

test('normal canvas gestures select and move the outer Gfx block', async ({ page }) => {
  await page.goto('/');
  const block = page.locator('jabr-square-gfx').first();
  const id = await page.evaluate(() =>
    window.__jabrHost?.root.blocks.find(model => (model as unknown as { flavour?: string }).flavour === 'jabr:square')?.id ?? null
  );
  expect(id).not.toBeNull();

  const before = await page.evaluate(blockId => {
    const model = window.__jabrHost?.doc.getBlockById(blockId) as unknown as { xywh: string } | null;
    return model ? JSON.parse(model.xywh) as number[] : null;
  }, id!);
  const bounds = await block.boundingBox();
  expect(bounds).not.toBeNull();
  const centerX = bounds!.x + bounds!.width / 2;
  const centerY = bounds!.y + bounds!.height / 2;

  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX + 48, centerY + 32, { steps: 6 });
  await page.mouse.up();

  await expect.poll(async () => page.evaluate(blockId => {
    const model = window.__jabrHost?.doc.getBlockById(blockId) as unknown as { xywh: string } | null;
    return model ? (JSON.parse(model.xywh) as number[])[0] : null;
  }, id!)).toBeGreaterThan(before![0] + 15);

  await expect(page.getByRole('button', { name: 'Square 1' })).toHaveAttribute('aria-current', 'true');
});

test('properties inspector updates outer dimensions and rotation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Square 1' }).click();

  const width = page.locator('jabr-properties-panel input[name="width"]');
  await width.fill('190');
  await width.press('Tab');
  await expect.poll(async () => page.evaluate(() => {
    const model = window.__jabrHost?.root.selection.selectedElements[0] as unknown as { xywh: string } | undefined;
    return model ? (JSON.parse(model.xywh) as number[])[2] : null;
  })).toBe(190);

  const rotation = page.locator('jabr-properties-panel input[name="rotation"]');
  await rotation.fill('27');
  await rotation.press('Tab');
  await expect.poll(async () => page.evaluate(() =>
    (window.__jabrHost?.root.selection.selectedElements[0] as unknown as { rotate: number } | undefined)?.rotate ?? null
  )).toBe(27);
});

test('BlockSuite selection handles resize and rotate the outer Gfx object', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Square 1' }).click();
  const block = page.locator('jabr-square-gfx').first();

  const id = await page.evaluate(() =>
    window.__jabrHost?.root.blocks.find(model => model.flavour === 'jabr:square')?.id ?? null
  );
  expect(id).not.toBeNull();

  const beforeResize = await page.evaluate(blockId => {
    const model = window.__jabrHost!.doc.getBlockById(blockId) as unknown as { xywh: string };
    return JSON.parse(model.xywh) as number[];
  }, id!);

  const resizeHandle = page.locator('edgeless-selected-rect .affine-edgeless-selected-rect .handle[aria-label="bottom-right"] .resize');
  await expect(resizeHandle).toBeVisible();
  const resizeBounds = await resizeHandle.boundingBox();
  expect(resizeBounds).not.toBeNull();
  const resizeX = resizeBounds!.x + resizeBounds!.width / 2;
  const resizeY = resizeBounds!.y + resizeBounds!.height / 2;
  await page.mouse.move(resizeX, resizeY);
  await page.mouse.down();
  await page.mouse.move(resizeX + 32, resizeY + 26, { steps: 5 });
  await page.mouse.up();

  await expect.poll(async () => page.evaluate(blockId => {
    const model = window.__jabrHost!.doc.getBlockById(blockId) as unknown as { xywh: string };
    return (JSON.parse(model.xywh) as number[])[2];
  }, id!)).toBeGreaterThan(beforeResize[2] + 10);

  // Recenter after resizing so the rotation gesture and its full arc stay
  // inside the Edgeless viewport rather than crossing the inspector overlay.
  await page.evaluate(blockId => {
    const selectedModel = window.__jabrHost!.doc.getBlockById(blockId) as unknown as { xywh: string };
    const [x, y, width, height] = JSON.parse(selectedModel.xywh) as number[];
    const viewport = widget.gfx.viewport;
    const rootViewport = window.__jabrHost!.root.viewport;
    viewport.setViewport(viewport.zoom, [x + width / 2, y + height / 2], false);
  }, id!);

  const rotateHandle = page.locator('edgeless-selected-rect .affine-edgeless-selected-rect .handle[aria-label="top-right"] .rotate');
  await expect(rotateHandle).toBeVisible();
  const beforeRotation = await page.evaluate(blockId => {
    const model = window.__jabrHost!.doc.getBlockById(blockId) as unknown as { rotate: number };
    return model.rotate;
  }, id!);

  const blockBounds = await block.boundingBox();
  const rotateBounds = await rotateHandle.boundingBox();
  expect(blockBounds).not.toBeNull();
  expect(rotateBounds).not.toBeNull();
  const centerX = blockBounds!.x + blockBounds!.width / 2;
  const centerY = blockBounds!.y + blockBounds!.height / 2;

  // The rotate icon and resize hit-area overlap near the icon's center.
  // Start at its exposed top-right corner so BlockSuite receives the rotate gesture.
  const startX = rotateBounds!.x + rotateBounds!.width * 0.75;
  const startY = rotateBounds!.y + rotateBounds!.height * 0.25;
  const radius = Math.hypot(startX - centerX, startY - centerY);
  const startAngle = Math.atan2(startY - centerY, startX - centerX);
  const endAngle = startAngle + Math.PI / 6;
  const endX = centerX + Math.cos(endAngle) * radius;
  const endY = centerY + Math.sin(endAngle) * radius;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await expect(
    page.locator('edgeless-selected-rect .affine-edgeless-selected-rect')
  ).toHaveAttribute('data-mode', 'rotate');

  await page.evaluate(({ blockId, startX, startY, endX, endY }) => {
    const widget = document.querySelector('edgeless-selected-rect') as unknown as {
      gfx: { std: { host: EventTarget }; view: { get: (model: unknown) => unknown }; viewport: { toModelCoordFromClientCoord: (point: [number, number]) => [number, number] } };
    };
    const model = window.__jabrHost!.doc.getBlockById(blockId);
    const view = widget.gfx.view.get(model);
    const managerHost = widget.gfx.std.host;
    const viewport = window.__jabrHost!.root.viewport;
    const selectedModel = window.__jabrHost!.doc.getBlockById(blockId) as unknown as { xywh: string };
    const [x, y, width, height] = JSON.parse(selectedModel.xywh) as number[];
    const modelStart = viewport.toModelCoordFromClientCoord([startX, startY]);
    const modelEnd = viewport.toModelCoordFromClientCoord([endX, endY]);
    const modelCenter = [x + width / 2, y + height / 2];
    const a0 = Math.atan2(modelStart[1] - modelCenter[1], modelStart[0] - modelCenter[0]);
    const a1 = Math.atan2(modelEnd[1] - modelCenter[1], modelEnd[0] - modelCenter[0]);
    (window as Window & { __jabrRotationDiag?: {
      viewType: string | null; managerHostTag: string; sameAsEditorHost: boolean;
      moves: number; rotations: number[]; modelStart: number[]; modelEnd: number[];
      modelCenter: number[]; modelDelta: number; sameViewportAsRoot: boolean; clientMoves: number[][];
    } }).__jabrRotationDiag = {
      viewType: (view as { constructor: { name: string } } | null)?.constructor.name ?? null,
      managerHostTag: (managerHost as Element).tagName ?? managerHost.constructor.name,
      sameAsEditorHost: managerHost === (window.__jabrHost!.editor.std as unknown as { host: EventTarget }).host,
      moves: 0,
      rotations: [],
      modelStart,
      modelEnd,
      modelCenter,
      modelDelta: (a1 - a0) * 180 / Math.PI,
      sameViewportAsRoot: viewport === rootViewport,
      clientMoves: [],
    };
    managerHost.addEventListener('pointermove', event => {
      const diag = (window as Window & { __jabrRotationDiag?: {
        viewType: string | null; managerHostTag: string; sameAsEditorHost: boolean;
        moves: number; rotations: number[]; clientMoves: number[][];
      } }).__jabrRotationDiag!;
      const pointer = event as PointerEvent;
      diag.clientMoves.push([pointer.clientX, pointer.clientY]);
      diag.moves += 1;
      diag.rotations.push((window.__jabrHost!.doc.getBlockById(blockId) as unknown as { rotate: number }).rotate);
    }, false);
  }, { blockId: id!, startX, startY, endX, endY });

  for (let step = 1; step <= 8; step += 1) {
    await page.mouse.move(
      startX + (endX - startX) * step / 8,
      startY + (endY - startY) * step / 8
    );
  }
  const rotationDiag = await page.evaluate(() =>
    (window as Window & { __jabrRotationDiag?: {
      viewType: string | null; managerHostTag: string; sameAsEditorHost: boolean;
      moves: number; rotations: number[]; modelStart: number[]; modelEnd: number[];
      modelCenter: number[]; modelDelta: number;
    } }).__jabrRotationDiag
  );
  await page.mouse.up();
  console.log('JABR_ROTATION_DIAG', rotationDiag);

  await expect.poll(async () => page.evaluate(({ blockId, rotation }) =>
    Math.abs((window.__jabrHost!.doc.getBlockById(blockId) as unknown as { rotate: number }).rotate - rotation),
  { blockId: id!, rotation: beforeRotation })).toBeGreaterThan(5);

});

test('Layers selection supports BlockSuite z-order changes', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Square 2' }).click();

  const id = await page.evaluate(() => window.__jabrHost?.root.selection.selectedIds[0] ?? null);
  expect(id).not.toBeNull();
  const before = await page.evaluate(blockId =>
    (window.__jabrHost!.doc.getBlockById(blockId) as unknown as { index: string }).index,
  id!);

  await page.getByRole('button', { name: 'Bring forward' }).click();
  await expect.poll(async () => page.evaluate(blockId =>
    (window.__jabrHost!.doc.getBlockById(blockId) as unknown as { index: string }).index,
  id!)).not.toBe(before);
});


