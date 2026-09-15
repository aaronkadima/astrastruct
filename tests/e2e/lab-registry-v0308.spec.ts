import {test,expect} from '@playwright/test';

test('P0 central registry owns all local mechanics Labs without legacy duplicate cards',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-chromium','central Lab registry consolidation');
  await page.goto('./');await page.evaluate(()=>window.dispatchEvent(new CustomEvent('astrastruct:model-lab-open')));await page.getByRole('button',{name:'Lab isolado',exact:true}).click();
  const overlay=page.getByTestId('model-lab-overlay');const note=overlay.locator('.astra-lab-note');await expect(note).toContainText('Lab v0.31.2');await expect(note).toContainText('inspection-field/v1');await expect(note).toContainText('RuleEngine');await expect(note).toContainText('PENDENTE');
  const cards=overlay.locator('[data-registered-isolated-lab]');expect(await cards.count()).toBeGreaterThanOrEqual(7);
  for(const id of ['open-anchor-pullout-lab','open-bolt-group-lab','open-bolt-contact-lab','open-slot-contact-lab','open-connection-plate-lab','open-hole-contact-lab','open-punching-lab'])await expect(page.getByTestId(id)).toHaveCount(1);
  await page.getByTestId('open-anchor-pullout-lab').click();await expect(page.getByTestId('anchor-pullout-lab')).toBeVisible();await page.getByTestId('anchor-pullout-lab').getByLabel('Fechar').click();
  await expect(overlay).toBeVisible();expect(await cards.count()).toBeGreaterThanOrEqual(7);await page.getByTestId('open-punching-lab').click();await expect(page.getByTestId('punching-lab')).toBeVisible();
});
