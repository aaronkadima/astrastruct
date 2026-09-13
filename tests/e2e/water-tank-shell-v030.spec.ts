import {test,expect} from '@playwright/test';

test('Model Lab opens hydrostatic rectangular Shell4 tank example',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-chromium','Shell4 tank example workflow');
  await page.goto('./');await page.getByTestId('model-lab-launch').click();const open=page.getByTestId('open-shell-water-tank-example');await expect(open).toBeVisible();await Promise.all([page.waitForEvent('framenavigated'),open.click()]);
  const canvas=page.getByTestId('spatial-canvas-3d');await expect(canvas).toHaveAttribute('data-shell-count','36');
  const state=await page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('astrastruct.project')||'{}');return{kind:p.meta?.exampleKind,name:p.name,shells:(p.elements||[]).filter((e:any)=>e.type==='shell4').length,hydro:(p.elementLoads||[]).filter((l:any)=>l.source==='hydrostatic').length,surfaces:[...new Set((p.elements||[]).filter((e:any)=>e.type==='shell4').map((e:any)=>e.surface))],scenario:p.settings?.analysisScenarioId}});expect(state).toMatchObject({kind:'rectangular-water-tank-shell4',shells:36,hydro:36,scenario:'WATER'});expect(state.surfaces.sort()).toEqual(['bottom','east','north','south','west']);
  await page.getByTestId('analyze-button').click();await expect(page.getByTestId('spatial-canvas-3d')).toBeVisible();const field=page.getByLabel('Campo de esforço 3D');await field.selectOption('Mx');await expect(canvas).toHaveAttribute('data-force-mode','Mx');
});
