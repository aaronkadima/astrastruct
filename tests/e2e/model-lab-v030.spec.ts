import {test,expect} from '@playwright/test';

test.describe('v0.30 Lab & Modelos',()=>{
  test('opens examples and isolated-element Lab',async({page},testInfo)=>{
    test.skip(testInfo.project.name!=='desktop-chromium','feature-shell interaction test');
    await page.goto('./');const launch=page.getByTestId('model-lab-launch');await expect(launch).toBeVisible();await launch.click();
    const overlay=page.getByTestId('model-lab-overlay');await expect(overlay).toBeVisible();await expect(overlay.getByText('Edifício RC · 5 pavimentos')).toBeVisible();await expect(overlay.getByText('Galpão metálico')).toBeVisible();await expect(overlay.getByText('Reservatório elevado')).toBeVisible();
    await overlay.getByRole('button',{name:'Lab isolado'}).click();await expect(overlay.getByText('Viga isolada 3D')).toBeVisible();await expect(overlay.getByText('Coluna isolada 3D')).toBeVisible();await expect(overlay.getByText('Elemento + mola')).toBeVisible();
  });

  test('generates a multi-storey building from parametric plan grid',async({page},testInfo)=>{
    test.skip(testInfo.project.name!=='desktop-chromium','feature-shell interaction test');
    await page.goto('./');await page.getByTestId('model-lab-launch').click();const overlay=page.getByTestId('model-lab-overlay');await overlay.getByRole('button',{name:'Lançar edifício'}).click();
    await overlay.locator('[data-g-name]').fill('E2E edifício 2 pavimentos');await overlay.locator('[data-g-storeys]').fill('2');await overlay.locator('[data-g-x]').fill('4,6');await overlay.locator('[data-g-y]').fill('5');await overlay.locator('[data-g-h]').fill('3.2');
    await page.getByTestId('generate-grid-building').click();await expect(page.getByTestId('spatial-canvas-3d')).toBeVisible();
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('astrastruct.project')||'{}'));expect(saved.name).toBe('E2E edifício 2 pavimentos');expect(saved.meta.exampleKind).toBe('building-grid');expect(saved.nodes).toHaveLength(18);expect(saved.supports).toHaveLength(6);expect(saved.elements.length).toBeGreaterThan(15);
  });

  test('quick plan sketch extrudes to 3D',async({page},testInfo)=>{
    test.skip(testInfo.project.name!=='desktop-chromium','feature-shell interaction test');
    await page.goto('./');await page.getByTestId('model-lab-launch').click();const overlay=page.getByTestId('model-lab-overlay');await overlay.getByRole('button',{name:'Lançar edifício'}).click();await overlay.getByRole('button',{name:'Desenhar planta'}).click();await overlay.getByRole('button',{name:'Retângulo 10×8 m'}).click();await overlay.locator('[data-p-storeys]').fill('2');await page.getByTestId('generate-sketch-building').click();
    await expect(page.getByTestId('spatial-canvas-3d')).toBeVisible();const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('astrastruct.project')||'{}'));expect(saved.meta.exampleKind).toBe('building-plan');expect(saved.meta.plan.nodes).toHaveLength(4);expect(saved.meta.plan.edges).toHaveLength(4);expect(saved.nodes).toHaveLength(12);
  });
});
