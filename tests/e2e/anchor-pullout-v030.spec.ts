import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test('isolated Lab runs bonded anchor pull-out, exports CSV and scientific SVG',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-chromium','anchor pull-out laboratory workflow');
  await page.goto('./');
  await page.getByTestId('model-lab-launch').click();
  await page.getByRole('button',{name:'Lab isolado',exact:true}).click();
  const overlay=page.getByTestId('model-lab-overlay');
  await expect(overlay.locator('.astra-lab-note')).toContainText('Ancoragem / pull-out');
  const open=page.getByTestId('open-anchor-pullout-lab');await expect(open).toBeVisible();await open.click();
  const lab=page.getByTestId('anchor-pullout-lab');await expect(lab).toBeVisible();await expect(lab).toContainText('aderência distribuída');
  await lab.locator('[data-anchor-segments]').fill('12');await lab.locator('[data-anchor-steps]').fill('20');await lab.locator('[data-anchor-dmax]').fill('8');
  await page.getByTestId('run-anchor-pullout').click();
  const chart=page.getByTestId('anchor-pullout-chart'),profile=page.getByTestId('anchor-bond-profile');await expect(chart).toBeVisible();await expect(profile).toBeVisible();await expect(lab).toContainText('Pico');await expect(lab).toContainText('kN');await expect(lab).toContainText('MPa');
  const peak=await lab.locator('.anchor-lab-kpi').filter({hasText:'Pico'}).locator('strong').textContent();expect(parseFloat(peak||'0')).toBeGreaterThan(0);

  const csvPromise=page.waitForEvent('download');await lab.locator('[data-anchor-csv]').click();const csvDownload=await csvPromise;expect(csvDownload.suggestedFilename()).toMatch(/anchor-pullout-curva\.csv$/);const csvPath=await csvDownload.path();expect(csvPath).toBeTruthy();const csv=await readFile(csvPath!,'utf8');expect(csv).toContain('deslocamento_mm,forca_kN');expect(csv.trim().split(/\r?\n/).length).toBeGreaterThan(10);

  // The pull-out load-slip curve is an SVG react-chart, so it participates in
  // the same vector scientific-export workflow used by structural result charts.
  const svgPromise=page.waitForEvent('download');await page.locator('[data-modern-action="figure:svg"]').first().evaluate((el:any)=>el.click());const svgDownload=await svgPromise;expect(svgDownload.suggestedFilename()).toMatch(/figura-cientifica\.svg$/i);const svgPath=await svgDownload.path();expect(svgPath).toBeTruthy();const svg=await readFile(svgPath!,'utf8');expect(svg).toContain('Força de pull-out');expect(svg).toContain('Deslizamento imposto');
});
