import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test('isolated Lab resolves explicit circular-hole distributed bearing contact',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-chromium','explicit-hole distributed contact laboratory workflow');
  await page.goto('./');
  await page.getByTestId('model-lab-launch').click();
  await page.getByRole('button',{name:'Lab isolado',exact:true}).click();
  const overlay=page.getByTestId('model-lab-overlay');
  await expect(overlay.locator('.astra-lab-note')).toContainText('furo circular explicitamente vazado');
  await page.getByTestId('open-hole-contact-lab').click();
  const lab=page.getByTestId('hole-contact-lab');await expect(lab).toBeVisible();
  await lab.locator('[data-hole-mx]').fill('6');
  await lab.locator('[data-hole-my]').fill('4');
  await lab.locator('[data-hole-cut]').fill('8');
  await lab.locator('[data-hole-segments]').fill('48');
  await lab.locator('[data-hole-steps]').fill('6');
  await lab.locator('[data-hole-fy]').fill('100');
  await lab.locator('[data-hole-disp]').fill('4');
  await page.getByTestId('run-hole-contact').click();
  await expect(page.getByTestId('hole-contact-map')).toBeVisible();
  await expect(page.getByTestId('hole-pressure-curve')).toBeVisible();
  const rows=page.getByTestId('hole-contact-table').locator('tbody tr');await expect(rows).toHaveCount(4);
  await expect(lab).toContainText('Pressão máx.');
  await expect(lab).toContainText('Arco ativo crítico');
  await expect(lab).toContainText('Ovalização máx.');
  await expect(lab).toContainText('Erro área vazia');
  const active=page.getByTestId('hole-contact-map').locator('[data-hole-pressure-segment="active"]');expect(await active.count()).toBeGreaterThan(0);
  const kpis=lab.locator('.hole-contact-kpi strong');
  const force=parseFloat((await kpis.nth(0).textContent())||'0'),pressure=parseFloat((await kpis.nth(1).textContent())||'0'),arc=parseFloat((await kpis.nth(2).textContent())||'0'),oval=parseFloat((await kpis.nth(3).textContent())||'0'),area=parseFloat((await kpis.nth(5).textContent())||'0'),areaErr=parseFloat((await kpis.nth(6).textContent())||'100'),residual=parseFloat((await kpis.nth(7).textContent())||'1');
  expect(force).toBeGreaterThan(1);expect(pressure).toBeGreaterThan(1);expect(arc).toBeGreaterThan(10);expect(oval).toBeGreaterThan(0);expect(area).toBeGreaterThan(0);expect(areaErr).toBeLessThan(12);expect(Math.abs(residual)).toBeLessThan(2e-3);
  for(let i=0;i<4;i++){const p=parseFloat((await rows.nth(i).locator('td').nth(2).textContent())||'0'),a=parseFloat((await rows.nth(i).locator('td').nth(3).textContent())||'0');expect(p).toBeGreaterThan(0);expect(a).toBeGreaterThan(0)}

  const csvPromise=page.waitForEvent('download');await lab.locator('[data-hole-csv]').click();const csvDownload=await csvPromise,csvPath=await csvDownload.path();expect(csvPath).toBeTruthy();const csv=await readFile(csvPath!,'utf8');expect(csv).toContain('pressure_MPa');expect(csv).toContain('radial_deformation_mm');
  const svgPromise=page.waitForEvent('download');await lab.locator('[data-hole-svg]').click();const svgDownload=await svgPromise,svgPath=await svgDownload.path();expect(svgPath).toBeTruthy();const svg=await readFile(svgPath!,'utf8');expect(svg).toContain('Chapa vazada');expect(svg).toContain('data-hole-pressure-segment');
});
