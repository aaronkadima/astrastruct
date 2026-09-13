import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test('isolated Lab closes bolt-hole clearance, maps bearing stress and preserves equilibrium',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-chromium','nonlinear bolt contact laboratory workflow');
  await page.goto('./');
  await page.getByTestId('model-lab-launch').click();
  await page.getByRole('button',{name:'Lab isolado',exact:true}).click();
  const overlay=page.getByTestId('model-lab-overlay');await expect(overlay.locator('.astra-lab-note')).toContainText('folga radial');
  await page.getByTestId('open-bolt-contact-lab').click();const lab=page.getByTestId('bolt-contact-lab');await expect(lab).toBeVisible();
  await lab.locator('[data-contact-k]').fill('200');await lab.locator('[data-contact-gap]').fill('1');await lab.locator('[data-contact-diameter]').fill('20');await lab.locator('[data-contact-plate-t]').fill('12');await lab.locator('[data-contact-yield]').fill('0');await lab.locator('[data-contact-fx]').fill('100');await lab.locator('[data-contact-fy]').fill('0');await lab.locator('[data-contact-mz]').fill('0');
  await page.getByTestId('run-bolt-contact').click();await expect(page.getByTestId('bolt-contact-chart')).toBeVisible();await expect(page.getByTestId('bolt-contact-stress-map')).toBeVisible();await expect(page.getByTestId('bolt-contact-stress-map')).toContainText('σb,eq');await expect(page.getByTestId('bolt-contact-stress-map')).toContainText('d=20.0 mm');await expect(page.getByTestId('bolt-contact-stress-map')).toContainText('t=12.0 mm');await expect(page.getByTestId('bolt-contact-table')).toBeVisible();await expect(lab).toContainText('4/4');
  const kpis=lab.locator('.bolt-contact-kpi strong');const sigma=parseFloat((await kpis.nth(2).textContent())||'0'),ux=parseFloat((await kpis.nth(3).textContent())||'0');expect(Math.abs(ux-1.125)).toBeLessThan(.01);expect(Math.abs(sigma-104.17)).toBeLessThan(.2);const rows=page.getByTestId('bolt-contact-table').locator('tbody tr');await expect(rows).toHaveCount(4);for(let i=0;i<4;i++){await expect(rows.nth(i).locator('td').nth(1)).toHaveText('bearing-elastic');await expect(rows.nth(i).locator('td').nth(4)).toHaveText('25.00');await expect(rows.nth(i).locator('td').nth(5)).toHaveText(/104\.1/)}
  const csvPromise=page.waitForEvent('download');await lab.locator('[data-contact-csv]').click();const csvDownload=await csvPromise;const csvPath=await csvDownload.path();expect(csvPath).toBeTruthy();const csv=await readFile(csvPath!,'utf8');expect(csv).toContain('penetration_mm');expect(csv).toContain('bearing_eq_MPa');expect(csv).toContain('bearing-elastic');
  const svgPromise=page.waitForEvent('download');await page.locator('[data-modern-action="figure:svg"]').first().evaluate((el:any)=>el.click());const svgDownload=await svgPromise;const svgPath=await svgDownload.path();expect(svgPath).toBeTruthy();const svg=await readFile(svgPath!,'utf8');expect(svg).toContain('Contato não linear com folga');expect(svg).toContain('bearing elástico');
});
