import { expect, test, type Page } from '@playwright/test';

async function visible(locator: ReturnType<Page['locator']>) {
  return locator.isVisible().catch(() => false);
}

async function openCommand(page:Page,label:string){
  const width=page.viewportSize()?.width||1280;
  if(width<=1100){
    const more=page.locator('button[aria-label="Mais comandos"]:visible').first();
    await expect(more).toBeVisible();await more.click();
    const command=page.locator(`.command-sheet button[aria-label="${label}"]:visible`).first();
    await expect(command).toBeVisible();await command.click();return;
  }
  const direct=page.locator(`button[aria-label="${label}"]:visible`).first();
  if(await visible(direct)){await direct.click();return}
  const library=page.locator('.library-tools button').filter({hasText:label}).first();
  if(await visible(library)){await library.scrollIntoViewIfNeeded();await library.click();return}
  throw new Error(`Comando não encontrado: ${label}`);
}

async function persistedProject(page:Page){
  return page.evaluate(()=>{const raw=localStorage.getItem('astrastruct.project');return raw?JSON.parse(raw):null});
}

test('selected buckling mode becomes a P-Delta geometric imperfection',async({page})=>{
  await page.goto('./');
  await expect(page.getByTestId('astra-app')).toBeVisible();
  await openCommand(page,'Estabilidade');
  await expect(page.getByTestId('panel-buckling')).toBeVisible();
  await page.getByTestId('buckling-calculate').click();
  const critical=Number(await page.getByTestId('buckling-critical-factor').textContent());
  expect(critical).toBeGreaterThan(1);

  const amplitude=page.getByTestId('imperfection-amplitude');
  await amplitude.fill('8');
  await page.getByTestId('apply-imperfection').click();
  await expect(page.getByTestId('imperfection-active')).toContainText('8.00 mm');
  await expect.poll(async()=>{const p=await persistedProject(page);return p?.settings?.analysisType}).toBe('pdelta');
  await expect.poll(async()=>{const p=await persistedProject(page);return p?.settings?.imperfection?.enabled}).toBe(true);
  await expect.poll(async()=>{const p=await persistedProject(page);return Number(p?.settings?.imperfection?.amplitudeMm)}).toBe(8);

  await page.getByTestId('panel-buckling').locator('button[aria-label="Fechar"]').click();
  await page.getByTestId('analyze-button').click();
  await expect(page.getByTestId('imperfection-result-metric')).toBeVisible();
  await expect(page.getByTestId('imperfection-result-metric')).toContainText('8.00 mm');
  await expect(page.locator('.results-content')).toContainText('u₀');
  await expect(page.locator('.results-content')).toContainText('ΔUx');
  await expect(page.locator('.results-content')).toContainText('Ux total');
  await expect(page.getByTestId('deformed-overlay')).toBeVisible();
});

test('selected buckling mode becomes a stress-free corotational reference geometry',async({page})=>{
  await page.goto('./');
  await expect(page.getByTestId('astra-app')).toBeVisible();
  await openCommand(page,'Estabilidade');
  await expect(page.getByTestId('panel-buckling')).toBeVisible();
  await page.getByTestId('buckling-calculate').click();
  const critical=Number(await page.getByTestId('buckling-critical-factor').textContent());
  expect(critical).toBeGreaterThan(1);

  await page.getByTestId('imperfection-amplitude').fill('6');
  await page.getByTestId('apply-corotational-imperfection').click();
  await expect(page.getByTestId('imperfection-active')).toContainText('co‑rotacional');
  await expect(page.getByTestId('imperfection-active')).toContainText('6.00 mm');
  await expect.poll(async()=>{const p=await persistedProject(page);return [p?.settings?.analysisType,p?.settings?.imperfection?.enabled,Number(p?.settings?.imperfection?.amplitudeMm)]}).toEqual(['corotational',true,6]);

  await page.getByTestId('panel-buckling').locator('button[aria-label="Fechar"]').click();
  await page.getByTestId('analyze-button').click();
  await expect(page.getByTestId('nonlinear-result-metric')).toBeVisible();
  await expect(page.getByTestId('deformed-overlay')).toBeVisible();

  await openCommand(page,'Diagramas/envelopes');
  const post=page.getByTestId('panel-nonlinear-postprocess');
  await expect(post).toBeVisible();
  await expect(page.getByTestId('corotational-imperfection-note')).toContainText('6.000 mm');
  await expect(page.getByTestId('corotational-imperfection-note')).toContainText('referência imperfeita sem tensões');
  await post.locator('button[aria-label="Fechar"]').click();

  await openCommand(page,'Relatório técnico');
  const report=page.getByTestId('panel-nonlinear-report');
  await expect(report).toBeVisible();
  await expect(page.getByTestId('nonlinear-imperfection-model')).toContainText('geometria de referência sem tensões');
  await expect(report).toContainText('u₀');
  await expect(report).toContainText('Δu');
});
