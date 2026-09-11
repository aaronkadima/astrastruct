import { expect, test, type Page } from '@playwright/test';

async function openStability(page:Page){
  const width=page.viewportSize()?.width||1280;
  if(width<=1100){
    const more=page.locator('button[aria-label="Mais comandos"]:visible').first();await expect(more).toBeVisible();await more.click();
    const button=page.locator('.command-sheet button[aria-label="Estabilidade"]:visible').first();await expect(button).toBeVisible();await button.click();return;
  }
  const direct=page.locator('button[aria-label="Estabilidade"]:visible').first();await expect(direct).toBeVisible();await direct.click();
}

test('linear buckling panel calculates modes and displays selected mode',async({page})=>{
  await page.goto('./');
  await openStability(page);
  const panel=page.getByTestId('panel-buckling');await expect(panel).toBeVisible();
  await page.getByTestId('buckling-calculate').click();
  const factor=page.getByTestId('buckling-critical-factor');await expect(factor).toBeVisible();
  await expect.poll(async()=>Number(await factor.textContent())).toBeGreaterThan(0);
  const overlay=page.getByTestId('buckling-mode-overlay');await expect(overlay).toBeVisible();
  await expect(overlay).toHaveAttribute('data-mode','1');
  expect(await page.locator('.buckling-mode-curve').count()).toBeGreaterThan(0);
  await expect(page.getByLabel('Escala do modo de flambagem')).toBeVisible();

  const second=page.getByTestId('buckling-mode-2');
  if(await second.count()){await second.click();await expect(overlay).toHaveAttribute('data-mode','2')}
  await panel.locator('button[aria-label="Fechar"]').click();
  await expect(panel).toHaveCount(0);
  await expect(overlay).toBeVisible();
  await page.getByTestId('toggle-buckling-mode').click();
  await expect(page.getByTestId('buckling-mode-overlay')).toHaveCount(0);
});
