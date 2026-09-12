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

test('context toolbar exposes quick node geometry and support editing',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-chromium','desktop contextual toolbar');
  await page.goto('./');
  await page.locator('circle.node').first().click();
  const context=page.getByTestId('context-toolbar');
  await expect(context).toBeVisible();
  await expect(context).toHaveAttribute('data-context-kind','node');
  const support=context.locator('[data-context-support]');
  await support.selectOption('fixed');
  await context.locator('[data-context-x]').fill('0.125');
  await context.getByTestId('context-apply').click();
  await expect(page.locator('.inspector-panel .check-grid input').nth(0)).toBeChecked();
  await expect(page.locator('.inspector-panel .check-grid input').nth(1)).toBeChecked();
  await expect(page.locator('.inspector-panel .check-grid input').nth(2)).toBeChecked();
  await expect(page.locator('.inspector-panel .inspector-grid input').first()).toHaveValue('0.125');
});

test('context toolbar switches to material and section controls for elements',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-chromium','desktop contextual toolbar');
  await page.goto('./');
  await page.locator('line.member').first().dispatchEvent('pointerdown',{button:0,pointerType:'mouse'});
  const context=page.getByTestId('context-toolbar');
  await expect(context).toBeVisible();
  await expect(context).toHaveAttribute('data-context-kind','element');
  await expect(context.locator('[data-context-material]')).toBeVisible();
  await expect(context.locator('[data-context-section]')).toBeVisible();
  await expect(context.getByTestId('context-apply')).toBeVisible();
});