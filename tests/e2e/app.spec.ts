import { expect, test, type Page } from '@playwright/test';

async function visible(locator: ReturnType<Page['locator']>) {
  return locator.isVisible().catch(() => false);
}

async function openCommand(page: Page, label: string) {
  const direct = page.locator(`button[aria-label="${label}"]:visible`).first();
  if (await visible(direct)) {
    await direct.click();
    return;
  }

  const library = page.locator('.library-tools button:visible').filter({ hasText: label }).first();
  if (await visible(library)) {
    await library.click();
    return;
  }

  const more = page.locator('button[aria-label="Mais comandos"]:visible').first();
  if (await visible(more)) {
    await more.click();
    const command = page.locator(`.command-sheet button[aria-label="${label}"]:visible`).first();
    await expect(command).toBeVisible();
    await command.click();
    return;
  }

  throw new Error(`Comando não encontrado na interface atual: ${label}`);
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
