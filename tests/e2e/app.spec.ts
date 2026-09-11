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

async function chooseModelTool(page:Page,label:string){
  const width=page.viewportSize()?.width||1280;
  if(width<=1100){
    await openCommand(page,label);
    return;
  }
  const button=page.locator(`.model-tools button[aria-label="${label}"]`).first();
  await expect(button).toBeVisible();
  await button.click();
}

async function undoModel(page:Page){
  const width=page.viewportSize()?.width||1280;
  if(width<=1100){
    await openCommand(page,'Desfazer');
    return;
  }
  const button=page.locator('.model-tools button[aria-label="Desfazer"]').first();
  await expect(button).toBeEnabled();
  await button.click();
}

async function newProject(page:Page){
  const direct=page.locator('button[aria-label="Novo projeto"]:visible').first();
  if(await visible(direct)) await direct.click();
  else await openCommand(page,'Novo');
  await expect.poll(async()=>(await storedCounts(page)).nodes).toBe(0);
  await expect.poll(async()=>(await storedCounts(page)).elements).toBe(0);
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
  await newProject(page);
  const canvas=page.getByTestId('model-canvas');
  const box=await canvas.boundingBox();
  expect(box).not.toBeNull();

  await chooseModelTool(page,'Criar nó');
  await canvas.click({position:{x:(box!.width*.70),y:(box!.height*.30)}});
  await expect.poll(async()=>(await storedCounts(page)).nodes).toBe(1);

  await undoModel(page);
  await expect.poll(async()=>(await storedCounts(page)).nodes).toBe(0);

  await chooseModelTool(page,'Desenhar pórtico/viga');
  await canvas.click({position:{x:(box!.width*.34),y:(box!.height*.66)}});
  await canvas.click({position:{x:(box!.width*.72),y:(box!.height*.34)}});
  await expect.poll(async()=>(await storedCounts(page)).nodes).toBe(2);
  await expect.poll(async()=>(await storedCounts(page)).elements).toBe(1);

  await undoModel(page);
  await expect.poll(async()=>(await storedCounts(page)).nodes).toBe(0);
  await expect.poll(async()=>(await storedCounts(page)).elements).toBe(0);
});
