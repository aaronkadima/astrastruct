import {test,expect} from '@playwright/test';

async function openScientificExport(page:any){
  await page.getByRole('button',{name:'Exibir',exact:true}).click();
  await page.getByRole('menuitem',{name:'Configurar/exportar figura científica…'}).click();
  await expect(page.getByTestId('scientific-export-dialog')).toBeVisible();
}

test('scientific export panel exposes publication presets',async({page})=>{
  await page.goto('./');
  await openScientificExport(page);
  const width=page.getByTestId('scientific-width');
  await expect(width).toHaveValue('180');
  await page.getByRole('button',{name:'1 coluna · 90 mm'}).click();
  await expect(width).toHaveValue('90');
  await page.getByTestId('scientific-dpi').selectOption('1200');
  await expect(page.getByTestId('scientific-dpi')).toHaveValue('1200');
  await page.getByTestId('scientific-background').selectOption('white');
  await expect(page.getByTestId('scientific-background')).toHaveValue('white');
  await expect(page.getByText(/4\.252 × 2\.891 px|4,252 × 2,891 px|4\.252 ×/)).toBeVisible();
});

test('configured scientific export downloads vector SVG',async({page})=>{
  await page.goto('./');
  await openScientificExport(page);
  await page.getByRole('button',{name:'2 colunas · 180 mm'}).click();
  await page.getByTestId('scientific-dpi').selectOption('600');
  const downloadPromise=page.waitForEvent('download');
  await page.getByTestId('scientific-export-svg').click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/figura-cientifica-180mm-600dpi\.svg$/i);
});

test('scientific export dialog is responsive and keyboard accessible',async({page})=>{
  await page.goto('./');
  await page.keyboard.press('Control+Shift+E');
  const dialog=page.getByTestId('scientific-export-dialog');
  await expect(dialog).toBeVisible();
  const box=await dialog.boundingBox(),viewport=page.viewportSize();
  expect(box?.width||0).toBeLessThanOrEqual((viewport?.width||1280));
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});
