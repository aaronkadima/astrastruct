import { expect, test, type Page } from '@playwright/test';

async function openCommand(page:Page,label:string){
  const width=page.viewportSize()?.width||1280;
  if(width<=1100){
    const more=page.locator('button[aria-label="Mais comandos"]:visible').first();
    await expect(more).toBeVisible();await more.click();
    const command=page.locator(`.command-sheet button[aria-label="${label}"]:visible`).first();
    await expect(command).toBeVisible();await command.click();return;
  }
  const direct=page.locator(`button[aria-label="${label}"]:visible`).first();
  if(await direct.isVisible().catch(()=>false)){await direct.click();return}
  const library=page.locator('.library-tools button').filter({hasText:label}).first();
  await expect(library).toBeVisible();await library.click();
}

async function persistedProject(page:Page){
  return page.evaluate(()=>{const raw=localStorage.getItem('astrastruct.project');return raw?JSON.parse(raw):null});
}

test('co-rotational mode can be configured, solved and visualized in current geometry',async({page})=>{
  await page.goto('./');
  await openCommand(page,'Tipo de análise');
  await expect(page.getByTestId('panel-analysis')).toBeVisible();
  const mode=page.getByTestId('analysis-corotational');
  await expect(mode).toBeEnabled();await mode.click();
  await expect(page.getByTestId('corotational-controls')).toBeVisible();
  await page.getByTestId('nonlinear-steps').fill('6');
  await page.getByTestId('nonlinear-max-iterations').fill('40');
  await page.getByTestId('nonlinear-tolerance').fill('1e-9');
  await expect(page.getByTestId('nonlinear-line-search')).toBeChecked();
  await page.getByTestId('analysis-apply').click();
  await expect.poll(async()=>{const p=await persistedProject(page);return p?.settings?.analysisType}).toBe('corotational');
  await expect.poll(async()=>{const p=await persistedProject(page);return Number(p?.settings?.nonlinearSteps)}).toBe(6);
  await expect.poll(async()=>{const p=await persistedProject(page);return Number(p?.settings?.nonlinearMaxIterations)}).toBe(40);
  await expect.poll(async()=>{const p=await persistedProject(page);return Number(p?.settings?.nonlinearTolerance)}).toBe(1e-9);
  await page.getByTestId('analyze-button').click();
  await expect(page.getByTestId('nonlinear-result-metric')).toBeVisible();
  await expect(page.getByTestId('nonlinear-result-metric')).toContainText('6 incrementos');
  await expect(page.getByTestId('nonlinear-result-note')).toContainText('co‑rotacional');
  await expect(page.locator('.result-overlays')).toHaveAttribute('data-current-geometry','true');
  const deformed=page.getByTestId('deformed-overlay');
  await expect(deformed).toBeVisible();
  await expect(deformed).toHaveAttribute('data-physical-geometry','true');
  await expect(deformed).toHaveAttribute('data-deformation-scale','1');
  await expect(page.locator('.deformed-curve.nonlinear').first()).toBeVisible();
  const visualAmplifier=page.locator('.canvas-result-scales label[title="Escala gráfica da deformada"]');
  await expect(visualAmplifier).toBeHidden();

  await openCommand(page,'Diagramas/envelopes');
  await expect(page.getByTestId('panel-nonlinear-postprocess')).toBeVisible();
  await expect(page.getByTestId('nonlinear-envelope-note')).toContainText('Envelope não linear desabilitado');
  await expect(page.getByTestId('panel-nonlinear-postprocess')).toContainText('Comprimento corrente');
  await expect(page.getByTestId('panel-nonlinear-postprocess')).toContainText('σ superior(x)');
  await expect(page.getByTestId('panel-nonlinear-postprocess').locator('.segmented')).toHaveCount(0);
});

test('co-rotational mode refuses a model with a rotational release',async({page})=>{
  await page.goto('./');
  await page.evaluate(()=>{
    const raw=localStorage.getItem('astrastruct.project');if(!raw)throw new Error('Projeto inicial ausente');
    const p=JSON.parse(raw);p.elements[0].releases={...(p.elements[0].releases||{}),rz1:true};localStorage.setItem('astrastruct.project',JSON.stringify(p));
  });
  await page.reload();
  await openCommand(page,'Tipo de análise');
  await expect(page.getByTestId('analysis-corotational')).toBeDisabled();
  await expect(page.getByTestId('corotational-incompatibilities')).toContainText('Releases e ligações semirrígidas');
});
