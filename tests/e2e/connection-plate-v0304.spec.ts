import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test('isolated Lab resolves flexible plate bearing and plasticization',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-chromium','flexible connection plate laboratory workflow');
  await page.goto('./');
  await page.getByTestId('model-lab-launch').click();
  await page.getByRole('button',{name:'Lab isolado',exact:true}).click();
  const overlay=page.getByTestId('model-lab-overlay');
  await expect(overlay.locator('.astra-lab-note')).toContainText('chapa flexível Q4');
  await page.getByTestId('open-connection-plate-lab').click();
  const lab=page.getByTestId('connection-plate-lab');await expect(lab).toBeVisible();
  await lab.locator('[data-plate-mx]').fill('4');
  await lab.locator('[data-plate-my]').fill('4');
  await lab.locator('[data-plate-steps]').fill('8');
  await lab.locator('[data-plate-fy]').fill('80');
  await lab.locator('[data-plate-disp]').fill('5');
  await page.getByTestId('run-connection-plate').click();
  await expect(page.getByTestId('connection-plate-stress-map')).toBeVisible();
  await expect(page.getByTestId('connection-plate-curve')).toBeVisible();
  const rows=page.getByTestId('connection-plate-bolt-table').locator('tbody tr');await expect(rows).toHaveCount(4);
  await expect(lab).toContainText('Área plastificada');
  await expect(lab).toContainText('1º contato');
  await expect(lab).toContainText('1ª plastificação');
  const kpis=lab.locator('.plate-flex-kpi strong');
  const force=parseFloat((await kpis.nth(0).textContent())||'0'),area=parseFloat((await kpis.nth(2).textContent())||'0'),residual=parseFloat((await kpis.nth(5).textContent())||'1');
  expect(force).toBeGreaterThan(1);expect(area).toBeGreaterThan(0);expect(Math.abs(residual)).toBeLessThan(1e-4);
  for(let i=0;i<4;i++){await expect(rows.nth(i).locator('td').nth(1)).not.toHaveText('gap');const sigma=parseFloat((await rows.nth(i).locator('td').nth(4).textContent())||'0');expect(sigma).toBeGreaterThan(0)}

  const csvPromise=page.waitForEvent('download');await lab.locator('[data-plate-csv]').click();const csvDownload=await csvPromise,csvPath=await csvDownload.path();expect(csvPath).toBeTruthy();const csv=await readFile(csvPath!,'utf8');expect(csv).toContain('sigma_vm_max_MPa');expect(csv).toContain('fracao_plastificada');
  const svgPromise=page.waitForEvent('download');await lab.locator('[data-plate-svg]').click();const svgDownload=await svgPromise,svgPath=await svgDownload.path();expect(svgPath).toBeTruthy();const svg=await readFile(svgPath!,'utf8');expect(svg).toContain('Mapa de tensão de von Mises');expect(svg).toContain('σvm / fy');
});
