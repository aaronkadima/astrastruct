import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test('isolated Lab solves rigid-plate bolt group and exports results',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-chromium','bolt-group laboratory workflow');
  await page.goto('./');
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('astrastruct:model-lab-open')));
  await page.getByRole('button',{name:'Lab isolado',exact:true}).click();
  const overlay=page.getByTestId('model-lab-overlay');
  await expect(overlay.locator('.astra-lab-note')).toContainText('Ligação chapa–parafuso');
  const open=page.getByTestId('open-bolt-group-lab');await expect(open).toBeVisible();await open.click();
  const lab=page.getByTestId('bolt-group-lab');await expect(lab).toBeVisible();await expect(lab).toContainText('Placa rígida');
  await lab.locator('[data-bolt-fx]').fill('100');await lab.locator('[data-bolt-fy]').fill('0');await lab.locator('[data-bolt-mz]').fill('0');await lab.locator('[data-bolt-ex]').fill('0');await lab.locator('[data-bolt-ey]').fill('0');
  await page.getByTestId('run-bolt-group').click();
  await expect(page.getByTestId('bolt-group-chart')).toBeVisible();await expect(page.getByTestId('bolt-group-table')).toBeVisible();await expect(lab).toContainText('V máximo');await expect(lab).toContainText('25.00');
  const rows=page.getByTestId('bolt-group-table').locator('tbody tr');await expect(rows).toHaveCount(4);for(let i=0;i<4;i++)await expect(rows.nth(i).locator('td').nth(5)).toHaveText('25.00');

  const csvPromise=page.waitForEvent('download');await lab.locator('[data-bolt-csv]').click();const csvDownload=await csvPromise;expect(csvDownload.suggestedFilename()).toBe('bolt-group-demand.csv');const csvPath=await csvDownload.path();expect(csvPath).toBeTruthy();const csv=await readFile(csvPath!,'utf8');expect(csv).toContain('id,x_mm,y_mm,fx_kN,fy_kN,v_kN');expect(csv.trim().split(/\r?\n/)).toHaveLength(5);

  const svgPromise=page.waitForEvent('download');await page.locator('[data-modern-action="figure:svg"]').first().evaluate((el:any)=>el.click());const svgDownload=await svgPromise;const svgPath=await svgDownload.path();expect(svgPath).toBeTruthy();const svg=await readFile(svgPath!,'utf8');expect(svg).toContain('Distribuição de forças no grupo de parafusos');expect(svg).toContain('Fx=100.00 kN');
});
