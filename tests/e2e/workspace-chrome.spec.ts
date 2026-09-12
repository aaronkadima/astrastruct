import {test,expect} from '@playwright/test';

test('desktop workspace uses a professional bottom status bar instead of duplicate canvas navigation',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-chromium','desktop workspace check');
  await page.goto('./');
  const status=page.locator('.workspace-statusbar');
  await expect(status).toBeVisible();
  await expect(page.locator('.canvas-nav')).toBeHidden();
  await expect(page.locator('.canvas-hud')).toBeHidden();
  await expect(status.locator('[data-ws="model"]')).toContainText(/2D|3D/);
  await expect(status.locator('[data-ws="zoom"]')).toContainText('%');
  await expect(page.locator('.workspace-axes')).toHaveCount(1);
  const before=await status.locator('[data-ws="zoom"]').textContent();
  await page.getByRole('button',{name:'Aproximar',exact:true}).click();
  await expect.poll(async()=>status.locator('[data-ws="zoom"]').textContent()).not.toBe(before);
  await page.getByRole('button',{name:'Ajustar à vista',exact:true}).click();
  await expect(status.locator('[data-ws="zoom"]')).toContainText('100%');
});

test('Canvas preferences control grid labels axes contrast and persist',async({page})=>{
  await page.goto('./');
  await page.getByRole('button',{name:'Exibir',exact:true}).click();
  await page.getByRole('menuitem',{name:'Configurar Canvas…'}).click();
  const dialog=page.getByTestId('workspace-settings-dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Grade').uncheck();
  await dialog.getByLabel('Rótulos de nós, barras e resultados').uncheck();
  await dialog.getByLabel('Eixos globais X/Y').uncheck();
  await dialog.getByLabel('Contraste técnico elevado').check();
  await expect(page.getByTestId('astra-app')).toHaveClass(/workspace-grid-off/);
  await expect(page.getByTestId('astra-app')).toHaveClass(/workspace-labels-off/);
  await expect(page.getByTestId('astra-app')).toHaveClass(/workspace-high-contrast/);
  await expect(page.locator('.workspace-axes')).toHaveCount(0);
  await dialog.getByRole('button',{name:'Concluir'}).click();
  await page.reload();
  await expect(page.getByTestId('astra-app')).toHaveClass(/workspace-grid-off/);
  await expect(page.getByTestId('astra-app')).toHaveClass(/workspace-labels-off/);
  await expect(page.getByTestId('astra-app')).toHaveClass(/workspace-high-contrast/);
});

test('Canvas settings can switch theme without changing the structural project',async({page})=>{
  await page.goto('./');
  const projectBefore=await page.evaluate(()=>localStorage.getItem('astrastruct.project'));
  await page.getByRole('button',{name:'Exibir',exact:true}).click();
  await page.getByRole('menuitem',{name:'Configurar Canvas…'}).click();
  const dialog=page.getByTestId('workspace-settings-dialog');
  await dialog.getByLabel('Preto').check();
  await expect(page.getByTestId('astra-app')).toHaveClass(/canvas-black/);
  await dialog.getByRole('button',{name:'Concluir'}).click();
  const projectAfter=await page.evaluate(()=>localStorage.getItem('astrastruct.project'));
  expect(projectAfter).toBe(projectBefore);
});
