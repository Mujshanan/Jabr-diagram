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

  // Exercise the real Edgeless viewport zoom rather than a CSS-only scale.
  await page.evaluate(() => window.__jabrHost!.root.setZoomByAction('in'));
  const zoom = await page.evaluate(() => window.__jabrHost!.root.zoom);
  expect(zoom).toBeGreaterThan(1);

  const before = await page.evaluate(id => {
    const model = window.__jabrHost?.doc.getBlockById(id) as unknown as {
      handleX: number; handleY: number; xywh: string; rotate: number;
    } | null;
    return model ? {
      x: model.handleX, y: model.handleY, xywh: model.xywh, rotate: model.rotate,
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
  const targetX = startX + 24;
  const targetY = startY + 18;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(targetX, targetY, { steps: 5 });
  await page.mouse.up();

  await expect.poll(async () => page.evaluate(id => {
    const model = window.__jabrHost?.doc.getBlockById(id) as unknown as { handleX: number } | null;
    return model?.handleX ?? null;
  }, blockId!)).not.toBe(before!.x);
  await expect.poll(async () => page.evaluate(id => {
    const model = window.__jabrHost?.doc.getBlockById(id) as unknown as { handleY: number } | null;
    return model?.handleY ?? null;
  }, blockId!)).not.toBe(before!.y);

  const after = await page.evaluate(id => {
    const model = window.__jabrHost?.doc.getBlockById(id) as unknown as {
      handleX: number; handleY: number; xywh: string;
    } | null;
    return model ? { x: model.handleX, y: model.handleY, xywh: model.xywh } : null;
  }, blockId!);
  expect(after).not.toBeNull();
  expect(after!.xywh).toBe(before!.xywh);

  // A completed two-coordinate gesture must undo and redo as one logical edit.
  // blockUpdated is a property-change notification, not a transaction counter.
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(async () => page.evaluate(id => {
    const model = window.__jabrHost?.doc.getBlockById(id) as unknown as {
      handleX: number; handleY: number;
    } | null;
    return model ? [model.handleX, model.handleY] : null;
  }, blockId!)).toEqual([before!.x, before!.y]);

  await page.getByRole('button', { name: 'Redo' }).click();
  await expect.poll(async () => page.evaluate(id => {
    const model = window.__jabrHost?.doc.getBlockById(id) as unknown as {
      handleX: number; handleY: number;
    } | null;
    return model ? [model.handleX, model.handleY] : null;
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
      handleX: number; handleY: number;
    } | null;
    return model ? [model.handleX, model.handleY] : null;
  }, blockId!);

  const handle = block.locator('circle.jabr-square-handle');
  const bounds = await handle.boundingBox();
  expect(bounds).not.toBeNull();
  const startX = bounds!.x + bounds!.width / 2;
  const startY = bounds!.y + bounds!.height / 2;

  await svg.evaluate(node => {
    node.addEventListener('pointerdown', event => {
      (window as Window & { __jabrPointerId?: number }).__jabrPointerId = event.pointerId;
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
      handleX: number; handleY: number;
    } | null;
    return model ? [model.handleX, model.handleY] : null;
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

  const rotateHandle = page.locator('edgeless-selected-rect .affine-edgeless-selected-rect .handle[aria-label="top-right"] .rotate');
  await expect(rotateHandle).toBeVisible();

  const rotationBefore = await page.evaluate(blockId =>
    (window.__jabrHost!.doc.getBlockById(blockId) as unknown as { rotate: number }).rotate,
  id!);
  const resizedBounds = await block.boundingBox();
  const rotateBounds = await rotateHandle.boundingBox();
  expect(resizedBounds).not.toBeNull();
  expect(rotateBounds).not.toBeNull();

  const centerX = resizedBounds!.x + resizedBounds!.width / 2;
  const centerY = resizedBounds!.y + resizedBounds!.height / 2;
  const startX = rotateBounds!.x + rotateBounds!.width / 2;
  const startY = rotateBounds!.y + rotateBounds!.height / 2;
  const radius = Math.hypot(startX - centerX, startY - centerY);
  const startAngle = Math.atan2(startY - centerY, startX - centerX);
  const endAngle = startAngle + Math.PI / 6;
  const endX = centerX + Math.cos(endAngle) * radius;
  const endY = centerY + Math.sin(endAngle) * radius;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 8 });
  await page.mouse.up();

  await expect.poll(async () => page.evaluate(blockId =>
    (window.__jabrHost!.doc.getBlockById(blockId) as unknown as { rotate: number }).rotate,
  id!)).not.toBe(rotationBefore);
  await expect.poll(async () => page.evaluate(blockId =>
    Math.abs((window.__jabrHost!.doc.getBlockById(blockId) as unknown as { rotate: number }).rotate - rotationBefore),
  id!)).toBeGreaterThan(5);
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
