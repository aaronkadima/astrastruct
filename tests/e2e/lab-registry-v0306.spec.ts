import {test,expect} from '@playwright/test';

test('central Lab registry injects one stable explicit-hole card across rerenders',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-chromium','registry bridge regression');
  await page.goto('./');
  await page.getByTestId('model-lab-launch').click();
  const overlay=page.getByTestId('model-lab-overlay');
  await page.getByRole('button',{name:'Lab isolado',exact:true}).click();
  const registered=overlay.locator('[data-registered-isolated-lab="connection-plate-hole-contact"]');
  await expect(registered).toHaveCount(1);
  await expect(page.getByTestId('open-hole-contact-lab')).toHaveCount(1);

  await page.getByRole('button',{name:'Modelos 3D',exact:true}).click();
  await page.getByRole('button',{name:'Lab isolado',exact:true}).click();
  await expect(overlay.locator('[data-registered-isolated-lab="connection-plate-hole-contact"]')).toHaveCount(1);
  await expect(page.getByTestId('open-hole-contact-lab')).toHaveCount(1);

  await overlay.getByLabel('Fechar Lab').click();
  await page.getByTestId('model-lab-launch').click();
  await page.getByRole('button',{name:'Lab isolado',exact:true}).click();
  await expect(page.locator('[data-registered-isolated-lab="connection-plate-hole-contact"]')).toHaveCount(1);
  await page.getByTestId('open-hole-contact-lab').click();
  await expect(page.getByTestId('hole-contact-lab')).toBeVisible();
  await expect(page.getByTestId('hole-contact-lab')).toContainText('uy comum livre');
});
