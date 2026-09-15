import {test,expect} from '@playwright/test';

const dxfSample=`0
SECTION
2
HEADER
9
$INSUNITS
70
4
0
ENDSEC
0
SECTION
2
ENTITIES
0
LWPOLYLINE
8
ESTRUTURA
90
4
70
1
10
0
20
0
10
5000
20
0
10
5000
20
4000
10
0
20
4000
0
ENDSEC
0
EOF`;

test.describe('v0.30 Lab & Modelos',()=>{
  test('opens examples and isolated-element Lab',async({page},testInfo)=>{
    test.skip(testInfo.project.name!=='desktop-chromium','feature-shell interaction test');
    await page.goto('./');await expect(page.getByTestId('model-lab-launch')).toHaveCount(0);await page.evaluate(()=>window.dispatchEvent(new CustomEvent('astrastruct:model-lab-open')));
    const overlay=page.getByTestId('model-lab-overlay');await expect(overlay).toBeVisible();await expect(overlay.getByText('Edifício RC · 5 pavimentos')).toBeVisible();await expect(overlay.getByText('Galpão metálico')).toBeVisible();await expect(overlay.getByText('Reservatório elevado')).toBeVisible();
    await overlay.getByRole('button',{name:'Lab isolado'}).click();await expect(overlay.getByText('Viga isolada 3D')).toBeVisible();await expect(overlay.getByText('Coluna isolada 3D')).toBeVisible();await expect(overlay.getByText('Elemento + mola')).toBeVisible();
  });

  test('generates a multi-storey building from parametric plan grid with filled slabs',async({page},testInfo)=>{
    test.skip(testInfo.project.name!=='desktop-chromium','feature-shell interaction test');
    await page.goto('./');await page.evaluate(()=>window.dispatchEvent(new CustomEvent('astrastruct:model-lab-open')));const overlay=page.getByTestId('model-lab-overlay');await overlay.getByRole('button',{name:'Lançar edifício'}).click();
    await overlay.locator('[data-g-name]').fill('E2E edifício 2 pavimentos');await overlay.locator('[data-g-storeys]').fill('2');await overlay.locator('[data-g-x]').fill('4,6');await overlay.locator('[data-g-y]').fill('5');await overlay.locator('[data-g-h]').fill('3.2');
    await page.getByTestId('generate-grid-building').click();const canvas=page.getByTestId('spatial-canvas-3d');await expect(canvas).toBeVisible();await expect(canvas).toHaveAttribute('data-shell-count','4');
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('astrastruct.project')||'{}'));expect(saved.name).toBe('E2E edifício 2 pavimentos');expect(saved.meta.exampleKind).toBe('building-grid');expect(saved.nodes).toHaveLength(18);expect(saved.supports).toHaveLength(6);expect(saved.elements.length).toBeGreaterThan(15);expect(saved.meta.slabPanels).toBe(4);expect(saved.meta.slabThickness).toBe(.15);expect(saved.elements.filter((e:any)=>e.type==='shell4')).toHaveLength(4);expect(saved.elements.filter((e:any)=>e.type==='shell4').every((e:any)=>e.role==='slab'&&e.thickness===.15)).toBe(true);
  });

  test('quick plan sketch extrudes to 3D',async({page},testInfo)=>{
    test.skip(testInfo.project.name!=='desktop-chromium','feature-shell interaction test');
    await page.goto('./');await page.evaluate(()=>window.dispatchEvent(new CustomEvent('astrastruct:model-lab-open')));const overlay=page.getByTestId('model-lab-overlay');await overlay.getByRole('button',{name:'Lançar edifício'}).click();await overlay.getByRole('button',{name:'Desenhar planta'}).click();await overlay.getByRole('button',{name:'Retângulo 10×8 m'}).click();await overlay.locator('[data-p-storeys]').fill('2');await page.getByTestId('generate-sketch-building').click();
    await expect(page.getByTestId('spatial-canvas-3d')).toBeVisible();const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('astrastruct.project')||'{}'));expect(saved.meta.exampleKind).toBe('building-plan');expect(saved.meta.plan.nodes).toHaveLength(4);expect(saved.meta.plan.edges).toHaveLength(4);expect(saved.nodes).toHaveLength(12);
  });

  test('imports DXF layers, converts millimetres and extrudes a building',async({page},testInfo)=>{
    test.skip(testInfo.project.name!=='desktop-chromium','DXF import interaction test');
    await page.goto('./');await page.evaluate(()=>window.dispatchEvent(new CustomEvent('astrastruct:model-lab-open')));const overlay=page.getByTestId('model-lab-overlay');await overlay.getByRole('button',{name:'Lançar edifício'}).click();
    const dxfMode=page.getByTestId('dxf-import-mode');await expect(dxfMode).toBeVisible();await dxfMode.click();
    await page.getByTestId('dxf-plan-file').setInputFiles({name:'estrutura.dxf',mimeType:'text/plain',buffer:Buffer.from(dxfSample)});
    await expect(overlay.getByText(/4 nós · 4 linhas/)).toBeVisible();await expect(overlay.getByText(/DXF: mm → metros/)).toBeVisible();
    await overlay.locator('[data-dxf-storeys]').fill('2');await overlay.locator('[data-dxf-name]').fill('E2E DXF 2 pavimentos');await page.getByTestId('generate-dxf-building').click();
    await expect(page.getByTestId('spatial-canvas-3d')).toBeVisible();const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('astrastruct.project')||'{}'));
    expect(saved.name).toBe('E2E DXF 2 pavimentos');expect(saved.meta.exampleKind).toBe('building-plan');expect(saved.meta.dxfImport.fileName).toBe('estrutura.dxf');expect(saved.meta.dxfImport.unitsCode).toBe(4);expect(saved.meta.dxfImport.layers).toEqual(['ESTRUTURA']);expect(saved.meta.plan.nodes).toHaveLength(4);expect(saved.nodes).toHaveLength(12);
  });
});
