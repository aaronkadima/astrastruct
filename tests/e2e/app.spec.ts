import { expect, test, type Page } from '@playwright/test';

async function visible(locator: ReturnType<Page['locator']>) {
  return locator.isVisible().catch(() => false);
}

async function openCommand(page: Page, label: string) {
  const width = page.viewportSize()?.width || 1280;

  if (width <= 1100) {
    const more = page.locator('button[aria-label="Mais comandos"]:visible').first();
    await expect(more).toBeVisible();
    await more.click();
    const command = page.locator(`.command-sheet button[aria-label="${label}"]:visible`).first();
    await expect(command).toBeVisible();
    await command.click();
    return;
  }

  const direct = page.locator(`button[aria-label="${label}"]:visible`).first();
  if (await visible(direct)) {
    await direct.click();
    return;
  }

  const library = page.locator('.library-tools button').filter({ hasText: label }).first();
  if (await visible(library)) {
    await library.scrollIntoViewIfNeeded();
    await library.click();
    return;
  }

  throw new Error(`Comando não encontrado na interface atual: ${label}`);
}

async function storedCounts(page:Page){
  return page.evaluate(()=>{const raw=localStorage.getItem('astrastruct.project');const p=raw?JSON.parse(raw):null;return{nodes:p?.nodes?.length||0,elements:p?.elements?.length||0}});
}

test('AstraStruct mounts and analyzes demo model', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('astra-app')).toBeVisible();
  await expect(page.getByTestId('model-canvas')).toBeVisible();
  await page.getByTestId('analyze-button').click();
  await expect(page.getByText('Desl. máx.')).toBeVisible();
});

test('no bootstrap black screen', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('body')).not.toHaveText(/Inicializando AstraStruct/i);
  const box = await page.getByTestId('model-canvas').boundingBox();
  expect(box?.width || 0).toBeGreaterThan(100);
  expect(box?.height || 0).toBeGreaterThan(100);
});

test('migrated engineering panels mount without runtime failures', async ({ page }) => {
  await page.goto('./');
  await page.getByTestId('analyze-button').click();
  const panels: Array<[string,string]> = [
    ['Casos/combinações','panel-actions'],
    ['Diagramas/envelopes','panel-postprocess'],
    ['Cargas avançadas','panel-advanced'],
    ['Materiais e seções','panel-properties'],
    ['Molas e térmica','panel-mechanics'],
    ['Ligações','panel-connections'],
    ['Tensões','panel-stress'],
    ['Tipo de análise','panel-analysis'],
    ['Relatório técnico','panel-report'],
    ['VNL','panel-vnl']
  ];
  for (const [label,testId] of panels) {
    await openCommand(page,label);
    const panel = page.getByTestId(testId);
    await expect(panel).toBeVisible();
    const box = await panel.boundingBox();
    expect(box?.width || 0).toBeGreaterThan(250);
    expect(box?.height || 0).toBeGreaterThan(150);
    await panel.locator('button[aria-label="Fechar"]').click();
    await expect(panel).toHaveCount(0);
  }
});

test('React modeling creates nodes and members with undo', async ({ page }) => {
  await page.goto('./');
  const canvas=page.getByTestId('model-canvas');
  const box=await canvas.boundingBox();
  expect(box).not.toBeNull();
  const before=await storedCounts(page);

  await page.locator('.model-tools button[aria-label="Criar nó"]').click();
  await canvas.click({position:{x:(box!.width*.72),y:(box!.height*.28)}});
  await expect.poll(async()=>(await storedCounts(page)).nodes).toBe(before.nodes+1);

  await page.locator('.model-tools button[aria-label="Desfazer"]').click();
  await expect.poll(async()=>(await storedCounts(page)).nodes).toBe(before.nodes);

  await page.locator('.model-tools button[aria-label="Desenhar pórtico/viga"]').click();
  await canvas.click({position:{x:(box!.width*.68),y:(box!.height*.32)}});
  await canvas.click({position:{x:(box!.width*.82),y:(box!.height*.48)}});
  await expect.poll(async()=>(await storedCounts(page)).elements).toBe(before.elements+1);

  await page.locator('.model-tools button[aria-label="Desfazer"]').click();
  await expect.poll(async()=>(await storedCounts(page)).elements).toBe(before.elements);
});
