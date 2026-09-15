import {test,expect} from '@playwright/test';

test('P3 advanced connection mechanics Labs are registered and executable',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-chromium','P3 local mechanics workflow');
  await page.goto('./');await page.evaluate(()=>window.dispatchEvent(new CustomEvent('astrastruct:model-lab-open')));await page.getByRole('button',{name:'Lab isolado',exact:true}).click();
  for(const id of ['open-slip-bearing-lab','open-tstub-prying-lab','open-hole-damage-lab','open-anchor-concrete-interaction-lab'])await expect(page.getByTestId(id)).toBeVisible();
  await page.getByTestId('open-slip-bearing-lab').click();await page.getByTestId('run-slip-bearing').click();await expect(page.getByTestId('slip-bearing-chart')).toBeVisible();await expect(page.getByTestId('slip-bearing-table')).toContainText('bearing');await page.getByRole('button',{name:'Fechar',exact:true}).click();
  await page.getByTestId('open-tstub-prying-lab').click();await page.getByTestId('run-tstub-prying').click();await expect(page.getByTestId('tstub-prying-chart')).toBeVisible();await page.getByRole('button',{name:'Fechar',exact:true}).click();
  await page.getByTestId('open-hole-damage-lab').click();await page.getByTestId('run-hole-damage').click();await expect(page.getByTestId('hole-damage-chart')).toBeVisible();await page.getByRole('button',{name:'Fechar',exact:true}).click();
  await page.getByTestId('open-anchor-concrete-interaction-lab').click();await page.getByTestId('run-anchor-concrete-interaction').click();await expect(page.getByTestId('anchor-concrete-chart')).toBeVisible();
});
