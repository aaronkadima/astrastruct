import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test('isolated Lab resolves oriented slotted bolt-hole contact and maps bearing stress',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-chromium','slotted bolt-hole contact laboratory workflow');
  await page.goto('./');
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('astrastruct:model-lab-open')));
  await page.getByRole('button',{name:'Lab isolado',exact:true}).click();
  const overlay=page.getByTestId('model-lab-overlay');
  await expect(overlay.locator('.astra-lab-note')).toContainText('furo oblongo');
  await page.getByTestId('open-slot-contact-lab').click();
  const lab=page.getByTestId('slot-contact-lab');await expect(lab).toBeVisible();
  await lab.locator('[data-slot-k]').fill('200');
  await lab.locator('[data-slot-gap]').fill('1');
  await lab.locator('[data-slot-length]').fill('12');
  await lab.locator('[data-slot-angle]').fill('0');
  await lab.locator('[data-slot-diameter]').fill('20');
  await lab.locator('[data-slot-plate-t]').fill('12');
  await lab.locator('[data-slot-yield]').fill('0');
  await lab.locator('[data-slot-fx]').fill('80');
  await lab.locator('[data-slot-fy]').fill('0');
  await lab.locator('[data-slot-mz]').fill('0');
  await page.getByTestId('run-slot-contact').click();
  await expect(page.getByTestId('slot-contact-chart')).toBeVisible();
  await expect(page.getByTestId('slot-contact-stress-map')).toBeVisible();
  await expect(page.getByTestId('slot-contact-stress-map')).toContainText('σb,eq');
  await expect(page.getByTestId('slot-contact-stress-map')).toContainText('d=20.0 mm');
  await expect(page.getByTestId('slot-contact-table')).toBeVisible();
  await expect(lab).toContainText('4/4');
  const kpis=lab.locator('.slot-contact-kpi strong'),sigma=parseFloat((await kpis.nth(2).textContent())||'0'),ux=parseFloat((await kpis.nth(3).textContent())||'0');
  expect(Math.abs(ux-7.1)).toBeLessThan(.03);expect(Math.abs(sigma-83.33)).toBeLessThan(.2);
  const rows=page.getByTestId('slot-contact-table').locator('tbody tr');await expect(rows).toHaveCount(4);
  for(let i=0;i<4;i++){
    await expect(rows.nth(i).locator('td').nth(1)).toHaveText('bearing-elastic');
    await expect(rows.nth(i).locator('td').nth(2)).toHaveText('6.000');
    await expect(rows.nth(i).locator('td').nth(5)).toHaveText('20.00');
    await expect(rows.nth(i).locator('td').nth(6)).toHaveText(/83\.3/);
  }
  const csvPromise=page.waitForEvent('download');await lab.locator('[data-slot-csv]').click();const csvDownload=await csvPromise,csvPath=await csvDownload.path();expect(csvPath).toBeTruthy();const csv=await readFile(csvPath!,'utf8');expect(csv).toContain('slot_coordinate_mm');expect(csv).toContain('bearing_eq_MPa');expect(csv).toContain('bearing-elastic');
  const svgPromise=page.waitForEvent('download');await lab.locator('[data-slot-svg]').click();const svgDownload=await svgPromise,svgPath=await svgDownload.path();expect(svgPath).toBeTruthy();const svg=await readFile(svgPath!,'utf8');expect(svg).toContain('Contato em furos oblongos');expect(svg).toContain('Movimento livre dentro do rasgo');
});
