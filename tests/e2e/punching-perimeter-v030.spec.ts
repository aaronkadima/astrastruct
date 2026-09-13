import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test('isolated Lab calculates punching demand, maps perimeter stress, exports CSV and scientific SVG',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-chromium','punching perimeter laboratory workflow');
  await page.goto('./');
  await page.getByTestId('model-lab-launch').click();
  await page.getByRole('button',{name:'Lab isolado',exact:true}).click();
  const overlay=page.getByTestId('model-lab-overlay');
  await expect(overlay.locator('.astra-lab-note')).toContainText('Punção');
  const open=page.getByTestId('open-punching-lab');await expect(open).toBeVisible();await open.click();
  const lab=page.getByTestId('punching-lab');await expect(lab).toBeVisible();await expect(lab).toContainText('demanda no perímetro crítico');
  await lab.locator('[data-punch-cx]').fill('300');await lab.locator('[data-punch-cy]').fill('300');await lab.locator('[data-punch-d]').fill('200');await lab.locator('[data-punch-offset-ratio]').fill('2');await lab.locator('[data-punch-V]').fill('500');await lab.locator('[data-punch-Mx]').fill('0');await lab.locator('[data-punch-My]').fill('0');
  await page.getByTestId('run-punching-demand').click();
  const chart=page.getByTestId('punching-demand-chart'),map=page.getByTestId('punching-stress-map');await expect(chart).toBeVisible();await expect(map).toBeVisible();await expect(map).toContainText('distribuição contínua');await expect(map).toContainText('|τ|max');await expect(map).toContainText('pilar 300 × 300 mm');await expect(lab).toContainText('τ média');await expect(lab).toContainText('|τ| máximo');await expect(lab).toContainText('MPa');
  const kpis=lab.locator('.punching-lab-kpi strong'),avg=parseFloat((await kpis.nth(1).textContent())||'0'),max=parseFloat((await kpis.nth(2).textContent())||'0');expect(avg).toBeGreaterThan(0);expect(Math.abs(max-avg)).toBeLessThan(.002);

  // Add moment and verify the critical demand is amplified relative to average.
  await lab.locator('[data-punch-Mx]').fill('80');await lab.locator('[data-punch-My]').fill('45');await page.getByTestId('run-punching-demand').click();const avg2=parseFloat((await kpis.nth(1).textContent())||'0'),max2=parseFloat((await kpis.nth(2).textContent())||'0');expect(max2).toBeGreaterThan(avg2);await expect(page.getByTestId('punching-stress-map')).toContainText('Mx=80.0');await expect(page.getByTestId('punching-stress-map')).toContainText('My=45.0');

  const csvPromise=page.waitForEvent('download');await lab.locator('[data-punch-csv]').click();const csvDownload=await csvPromise;expect(csvDownload.suggestedFilename()).toBe('punching-perimeter-demand.csv');const csvPath=await csvDownload.path();expect(csvPath).toBeTruthy();const csv=await readFile(csvPath!,'utf8');expect(csv).toContain('s_m,x_m,y_m,q_kN_m,tau_MPa');expect(csv.trim().split(/\r?\n/).length).toBeGreaterThan(50);

  const svgPromise=page.waitForEvent('download');await page.locator('[data-modern-action="figure:svg"]').first().evaluate((el:any)=>el.click());const svgDownload=await svgPromise;const svgPath=await svgDownload.path();expect(svgPath).toBeTruthy();const svg=await readFile(svgPath!,'utf8');expect(svg).toContain('Distribuição de tensão de punção');expect(svg).toContain('Coordenada curvilínea');
});
