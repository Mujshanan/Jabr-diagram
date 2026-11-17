import { expect, test } from '@playwright/test';

test('mounts the BlockSuite Edgeless host and the three starter squares', async ({ page }) => {
  await page.goto('/');
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

test('internal point drag commits one document update and Escape exits edit mode', async ({ page }) => {
  await page.goto('/');
  const firstBlock = page.locator('jabr-square-gfx').first();
  await firstBlock.locator('svg').dblclick();
  const handle = firstBlock.locator('circle.handle');
  await expect(handle).toBeVisible();

  const blockId = await page.evaluate(() => {
    const model = window.__jabrHost?.root.blocks.find(item => item.flavour === 'jabr:square');
    return model?.id ?? null;
  });
  expect(blockId).not.toBeNull();

  await page.evaluate(id => {
    const host = window.__jabrHost!;
    (window as Window & { __jabrUpdateCount?: number }).__jabrUpdateCount = 0;
    host.doc.slots.blockUpdated.subscribe(payload => {
      if (payload.id === id && payload.type === 'update') {
        (window as Window & { __jabrUpdateCount?: number }).__jabrUpdateCount! += 1;
      }
    });
  }, blockId!);

  const before = await page.evaluate(id => {
    const model = window.__jabrHost?.doc.getBlockById(id) as unknown as { handleX: number; handleY: number } | null;
    return model ? { x: model.handleX, y: model.handleY } : null;
  }, blockId!);
  const bounds = await handle.boundingBox();
  expect(bounds).not.toBeNull();
  const startX = bounds!.x + bounds!.width / 2;
  const startY = bounds!.y + bounds!.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 24, startY + 18, { steps: 4 });
  await page.mouse.up();

  await expect.poll(async () => page.evaluate(id => {
    const model = window.__jabrHost?.doc.getBlockById(id) as unknown as { handleX: number; handleY: number } | null;
    return model ? model.handleX : null;
  }, blockId!)).toBeGreaterThan(before!.x + 5);
  await expect.poll(async () => page.evaluate(() =>
    (window as Window & { __jabrUpdateCount?: number }).__jabrUpdateCount ?? 0
  )).toBe(1);

  await page.keyboard.press('Escape');
  await expect(firstBlock.locator('circle.handle')).toHaveCount(0);
});
