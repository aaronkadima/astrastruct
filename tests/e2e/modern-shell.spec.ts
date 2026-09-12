import {test,expect} from '@playwright/test';

test('modern shell exposes desktop menus and canvas focus mode',async({page})=>{
  await page.goto('./');
  await expect(page.locator('.modern-menubar')).toBeVisible();
  await page.getByRole('button',{name:'Exibir',exact:true}).click();
  await page.getByRole('menuitem',{name:'Canvas ampliado'}).click();
  await expect(page.getByTestId('astra-app')).toHaveClass(/ui-canvas-focus/);
  const viewport=await page.locator('.viewport').boundingBox();
  expect(viewport?.width||0).toBeGreaterThan(700);
  const label=page.locator('.node-label').first();
  if(await label.count()){
    const fontSize=await label.evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
    expect(fontSize).toBeGreaterThanOrEqual(13);
  }
});

test('project can be saved with the AstraStruct .nz extension',async({page})=>{
  await page.goto('./');
  await page.getByRole('button',{name:'Arquivo',exact:true}).click();
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('menuitem',{name:'Salvar projeto .nz'}).click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.nz$/i);
});

test('stress visualization uses a large readable chart',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-chromium','desktop geometry check');
  await page.goto('./');
  await page.getByTestId('analyze-button').click();
  await page.getByRole('button',{name:'Resultados',exact:true}).click();
  await page.getByRole('menuitem',{name:'Tensões'}).click();
  const panel=page.getByTestId('panel-stress');
  await expect(panel).toBeVisible();
  const chart=panel.locator('.react-chart').first();
  await expect(chart).toBeVisible();
  const box=await chart.boundingBox();
  expect(box?.height||0).toBeGreaterThanOrEqual(300);
});
