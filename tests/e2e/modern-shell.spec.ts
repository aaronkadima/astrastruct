import {test,expect} from '@playwright/test';

test('modern shell exposes menus and canvas focus mode',async({page})=>{
  await page.goto('./');
  await expect(page.locator('.modern-menubar')).toBeVisible();
  await expect(page.getByRole('button',{name:'Arquivo',exact:true})).toBeVisible();
  await expect(page.locator('.modern-unified-tools')).toBeVisible();
  await expect(page.locator('.workspace-bar')).toBeHidden();
  await expect(page.locator('.modern-brand-copy')).toBeHidden();
  await page.getByRole('button',{name:'Exibir',exact:true}).click();
  await page.getByRole('menuitem',{name:'Canvas ampliado'}).click();
  await expect(page.getByTestId('astra-app')).toHaveClass(/ui-canvas-focus/);
  const viewport=await page.locator('.viewport').boundingBox();
  const screen=page.viewportSize();
  expect(viewport?.width||0).toBeGreaterThan((screen?.width||320)*0.85);
  const label=page.locator('.node-label').first();
  if(await label.count()){
    const fontSize=await label.evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
    expect(fontSize).toBeGreaterThanOrEqual(13);
  }
});

test('canvas can switch between black and white backgrounds',async({page})=>{
  await page.goto('./');
  await page.getByRole('button',{name:'Exibir',exact:true}).click();
  await page.getByRole('menuitemradio',{name:'Canvas · fundo preto'}).click();
  await expect(page.getByTestId('astra-app')).toHaveClass(/canvas-black/);
  await expect(page.locator('.viewport')).toHaveCSS('background-color','rgb(16, 17, 19)');
  await page.getByRole('button',{name:'Exibir',exact:true}).click();
  await page.getByRole('menuitemradio',{name:'Canvas · fundo branco'}).click();
  await expect(page.getByTestId('astra-app')).toHaveClass(/canvas-white/);
  await expect(page.locator('.viewport')).toHaveCSS('background-color','rgb(255, 255, 255)');
});

test('project can be saved with the AstraStruct .nz extension',async({page})=>{
  await page.goto('./');
  await page.getByRole('button',{name:'Arquivo',exact:true}).click();
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('menuitem',{name:'Salvar projeto .nz'}).click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.nz$/i);
});

test('scientific figure can be exported as standalone vector SVG',async({page})=>{
  await page.goto('./');
  await page.getByRole('button',{name:'Exibir',exact:true}).click();
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('menuitem',{name:'Exportar figura científica · SVG vetorial'}).click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/figura-cientifica\.svg$/i);
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
