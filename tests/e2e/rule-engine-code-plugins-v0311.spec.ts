import {test,expect} from '@playwright/test';

test('P4 RuleEngine exposes versioned AISC EN ACI and ABNT checks',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-chromium','normative RuleEngine workflow');
  await page.goto('./');await page.evaluate(()=>window.dispatchEvent(new CustomEvent('astrastruct:model-lab-open')));await page.getByRole('button',{name:'Lab isolado',exact:true}).click();
  await expect(page.getByTestId('open-code-checks-lab')).toBeVisible();await page.getByTestId('open-code-checks-lab').click();
  const lab=page.getByTestId('code-checks-lab');await expect(lab).toBeVisible();
  await page.getByTestId('run-code-checks').click();
  await expect(page.getByTestId('code-checks-table')).toContainText('Ruptura por block shear');await expect(page.getByTestId('code-provenance')).toContainText('ANSI/AISC 360-22');
  const select=lab.locator('[data-code-ruleset]');
  await select.selectOption('aci-318-25-punching-anchors');await page.getByTestId('run-code-checks').click();await expect(page.getByTestId('code-checks-table')).toContainText('Punção');await expect(page.getByTestId('code-provenance')).toContainText('ACI CODE-318-25');
  await select.selectOption('nbr-6118-2026-punching');await page.getByTestId('run-code-checks').click();await expect(page.getByTestId('code-provenance')).toContainText('ABNT NBR 6118:2026');
  const editor=lab.locator('[data-code-json]');await editor.fill(JSON.stringify({punching:{Vu:500}}));await page.getByTestId('run-code-checks').click();await expect(page.getByTestId('code-checks-table')).toContainText('PENDENTE');
});
