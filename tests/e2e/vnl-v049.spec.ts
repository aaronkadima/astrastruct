import { test, expect } from '@playwright/test';

test('VNL v0.49 executes, branches and persists with the project', async ({ page }) => {
  await page.goto('./');
  const launcher = page.getByTestId('vnl-v049-launcher');
  await expect(launcher).toBeVisible();
  await launcher.click();

  const workbench = page.getByTestId('vnl-v049-workbench');
  await expect(workbench).toBeVisible();
  await expect(workbench).toContainText('DAG tipado executável');
  await expect(workbench).toContainText('Grafo válido');

  const run = page.getByTestId('vnl-run');
  await expect(run).toBeEnabled();
  await run.click();
  await expect(workbench.locator('.vnl-execution')).toContainText('Execução concluída');
  await expect(workbench.locator('.vnl-execution')).toContainText('linear');

  await workbench.getByRole('button', { name: '+ Ramo de análise' }).click();
  await expect(workbench).toContainText('Grafo válido');
  await run.click();
  await expect(workbench.locator('.vnl-execution')).toContainText('Ramo paralelo');

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
  await page.getByTestId('vnl-v049-launcher').click();
  await expect(page.getByTestId('vnl-v049-workbench').locator('.vnl-card-v049')).toHaveCount(persisted.nodes);
});
