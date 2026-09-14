import { test, expect, type Page } from '@playwright/test';

async function visible(locator: ReturnType<Page['locator']>) {
  return locator.isVisible().catch(() => false);
}

async function openVnl(page: Page) {
  const width = page.viewportSize()?.width || 1280;
  if (width <= 1100) {
    const more = page.locator('button[aria-label="Mais comandos"]:visible').first();
    await expect(more).toBeVisible();
    await more.click();
    const command = page.locator('.command-sheet button[aria-label="VNL"]:visible').first();
    await expect(command).toBeVisible();
    await command.click();
  } else {
    const direct = page.locator('button[aria-label="VNL"]:visible').first();
    if (await visible(direct)) await direct.click();
    else {
      const library = page.locator('.library-tools button').filter({ hasText: 'VNL' }).first();
      await expect(library).toBeVisible();
      await library.scrollIntoViewIfNeeded();
      await library.click();
    }
  }
  await expect(page.getByTestId('vnl-v049-workbench')).toBeVisible();
}

test('VNL v0.49 executes, branches, guards invalid graphs, reuses Results and persists with the project', async ({ page }) => {
  await page.goto('./');
  await openVnl(page);

  const workbench = page.getByTestId('vnl-v049-workbench');
  await expect(workbench).toContainText('DAG tipado executável');
  await expect(workbench).toContainText('Grafo válido');

  const run = page.getByTestId('vnl-run');
  await expect(run).toBeEnabled();

  const resultCard = workbench.locator('.vnl-card-v049').filter({ hasText: 'Result' }).first();
  await resultCard.getByTitle('Remover').click();
  await expect(workbench).not.toContainText('Grafo válido');
  await expect(run).toBeDisabled();
  await workbench.getByRole('button', { name: 'Pipeline padrão' }).click();
  await expect(workbench).toContainText('Grafo válido');
  await expect(run).toBeEnabled();

  await run.click();
  await expect(workbench.locator('.vnl-execution')).toContainText('Execução concluída');
  await expect(workbench.locator('.vnl-execution')).toContainText('linear');

  await workbench.getByRole('button', { name: '+ Ramo de análise' }).click();
  await expect(workbench).toContainText('Grafo válido');
  await run.click();
  await expect(workbench.locator('.vnl-execution')).toContainText('Ramo paralelo');

  await page.getByTestId('vnl-show-main-result').click();
  const mainResult = page.getByTestId('vnl-main-result');
  await expect(mainResult).toBeVisible();
  await expect(mainResult).toContainText('Resultado VNL');
  await expect(mainResult).toContainText('linear');

  await openVnl(page);
  await workbench.getByRole('button', { name: 'Salvar no projeto' }).click();
  const persisted = await page.evaluate(() => {
    const raw = localStorage.getItem('astrastruct.project');
    const project = raw ? JSON.parse(raw) : null;
    return {
      contract: project?.vnl?.contract,
      version: project?.vnl?.version,
      nodes: project?.vnl?.graph?.nodes?.length || 0,
      edges: project?.vnl?.graph?.edges?.length || 0,
    };
  });
  expect(persisted.contract).toBe('project-vnl/v1');
  expect(persisted.version).toBe('0.49.0-exp');
  expect(persisted.nodes).toBeGreaterThan(9);
  expect(persisted.edges).toBeGreaterThan(8);

  await page.getByRole('button', { name: 'Fechar VNL' }).click();
  await page.reload();
  await openVnl(page);
  await expect(page.getByTestId('vnl-v049-workbench').locator('.vnl-card-v049')).toHaveCount(persisted.nodes);
});
