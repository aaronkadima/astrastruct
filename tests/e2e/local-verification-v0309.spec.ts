import {test,expect} from '@playwright/test';

test('P2 local verification Lab executes numerical sensitivity studies',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-chromium','local numerical verification workflow');
  await page.goto('./');
  await page.getByTestId('model-lab-launch').click();
  await page.getByRole('button',{name:'Lab isolado',exact:true}).click();
  await expect(page.getByTestId('open-local-verification-lab')).toBeVisible();
  await page.getByTestId('open-local-verification-lab').click();
  const lab=page.getByTestId('local-verification-lab');await expect(lab).toBeVisible();
  await lab.locator('[data-ver-mx]').fill('4');await lab.locator('[data-ver-my]').fill('4');await lab.locator('[data-ver-cut]').fill('4');await lab.locator('[data-ver-seg]').fill('24');await lab.locator('[data-ver-disp]').fill('1.5');
  await page.getByTestId('run-local-verification').click();
  await expect(page.getByTestId('verification-table')).toBeVisible({timeout:30000});
  await expect(page.getByTestId('verification-table')).toContainText('mesh');
  await expect(page.getByTestId('verification-table')).toContainText('quadrature');
  await expect(page.getByTestId('verification-table')).toContainText('angular');
  await expect(page.getByTestId('verification-table')).toContainText('kn');
  await expect(page.getByTestId('verification-warnings')).toBeVisible();
});
