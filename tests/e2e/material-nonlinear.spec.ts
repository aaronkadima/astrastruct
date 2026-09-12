import { expect, test, type Page } from '@playwright/test';

async function storedProject(page:Page){
  return page.evaluate(()=>{const raw=localStorage.getItem('astrastruct.project');return raw?JSON.parse(raw):null});
}

async function openCommand(page:Page,label:string){
  const width=page.viewportSize()?.width||1280;
  if(width<=1100){
    const more=page.locator('button[aria-label="Mais comandos"]:visible').first();await expect(more).toBeVisible();await more.click();
    const command=page.locator(`.command-sheet button[aria-label="${label}"]:visible`).first();await expect(command).toBeVisible();await command.click();return;
  }
  const direct=page.locator(`button[aria-label="${label}"]:visible`).first();
  if(await direct.isVisible().catch(()=>false)){await direct.click();return}
  const library=page.locator('.library-tools button').filter({hasText:label}).first();await expect(library).toBeVisible();await library.click();
}

async function installSteelCantilever(page:Page){
  await page.goto('./');
  await page.evaluate(()=>{
    const raw=localStorage.getItem('astrastruct.project');if(!raw)throw new Error('Projeto inicial ausente');
    const p=JSON.parse(raw),b=.2,h=.4,A=b*h,I=b*h**3/12;
    p.name='E2E — rótula de fibras v0.14';
    p.materials=[{id:'S355',name:'Steel S355 E2E',type:'steel',E:200e6,nu:.3,density:78.5,alpha:12e-6,fy:355,fu:510,verified:false}];
    p.sections=[{id:'R200x400',name:'Retangular 200 × 400 mm',family:'rect',b,h,A,I}];
    p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:2,y:0}];
    p.elements=[{id:'E1',type:'frame2d',n1:'N1',n2:'N2',materialId:'S355',sectionId:'R200x400',A,I,label:'Viga aço',releases:{rz1:false,rz2:false},rotationalSprings:{rz1:null,rz2:null}}];
    p.supports=[{nodeId:'N1',ux:true,uy:true,rz:true}];
    p.loads=[{id:'L1',caseId:'LC1',nodeId:'N2',fx:0,fy:0,mz:2200}];p.elementLoads=[];p.nodeSprings=[];p.settlements=[];
    p.settings={...(p.settings||{}),analysisType:'linear',activeLoadCaseId:'LC1',analysisScenarioId:'LC1',nonlinearSteps:12,nonlinearMaxIterations:45,nonlinearTolerance:1e-9,nonlinearLineSearch:true,materialMaxIterations:40,materialTolerance:2e-5,materialRelaxation:.7,imperfection:{...(p.settings?.imperfection||{}),enabled:false}};
    localStorage.setItem('astrastruct.project',JSON.stringify(p));
  });
  await page.reload();
}

async function openInspector(page:Page){
  const editor=page.getByTestId('fiber-hinge-rz2-enabled'),width=page.viewportSize()?.width||1280;
  if(width<=1100){
    const inspector=page.locator('button[aria-label="Inspector"]:visible').first();await expect(inspector).toBeVisible();await inspector.click();
  }
  await editor.scrollIntoViewIfNeeded();await expect(editor).toBeVisible();
}

test('v0.14 fiber hinge is configured, guarded, solved and traced through postprocess/report',async({page})=>{
  await installSteelCantilever(page);
  await expect(page.getByTestId('astra-app')).toBeVisible();
  const canvas=page.getByTestId('model-canvas');await expect(canvas).toBeVisible();const box=await canvas.boundingBox();if(!box)throw new Error('Canvas sem geometria');await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
  await openInspector(page);

  const enabled=page.getByTestId('fiber-hinge-rz2-enabled');await expect(enabled).toBeEnabled();await enabled.check();
  await page.getByTestId('fiber-hinge-rz2-lp').fill('0.35');
  await page.getByTestId('fiber-hinge-rz2-fibers').fill('100');
  await page.getByTestId('fiber-hinge-rz2-hardening').fill('0.01');
  const apply=page.getByRole('button',{name:'Aplicar alterações'}).last();await apply.scrollIntoViewIfNeeded();await apply.click();

  await expect.poll(async()=>{const p=await storedProject(page);const e=p?.elements?.find((x:any)=>x.id==='E1');return [p?.settings?.analysisType,e?.fiberHinges?.rz2?.enabled,Number(e?.fiberHinges?.rz2?.nFibers),Number(e?.fiberHinges?.rz2?.hingeLength),e?.releases?.rz2,e?.rotationalSprings?.rz2]}).toEqual(['corotational',true,100,.35,false,null]);

  if((page.viewportSize()?.width||1280)<=1100){const close=page.locator('.inspector-panel.open button[aria-label="Fechar"]:visible').first();if(await close.isVisible().catch(()=>false))await close.click()}

  await openCommand(page,'Tipo de análise');
  await expect(page.getByTestId('material-nonlinear-controls')).toBeVisible();
  await expect(page.getByTestId('material-nonlinear-controls')).toContainText('1 rótula');
  await page.getByTestId('analysis-linear').click();await expect(page.getByTestId('material-mode-warning')).toContainText('exige Geom. não linear');await expect(page.getByTestId('analysis-apply')).toBeDisabled();
  await page.getByTestId('analysis-corotational').click();await expect(page.getByTestId('analysis-apply')).toBeEnabled();
  await page.getByTestId('material-max-iterations').fill('32');await page.getByTestId('material-tolerance').fill('0.00001');await page.getByTestId('material-relaxation').fill('0.70');await page.getByTestId('analysis-apply').click();
  await expect.poll(async()=>{const p=await storedProject(page);return [Number(p?.settings?.materialMaxIterations),Number(p?.settings?.materialTolerance),Number(p?.settings?.materialRelaxation),p?.settings?.analysisType]}).toEqual([32,1e-5,.7,'corotational']);

  await page.getByTestId('analyze-button').click();
  const results=page.locator('.results-content');await expect(results).toBeVisible();
  await expect(results).toContainText('frame2d-corotational-fiber-hinge-experimental');
  await expect(page.getByTestId('nonlinear-result-metric')).toContainText('convergiu');
  await expect(page.getByTestId('deformed-overlay')).toBeVisible();
  await expect(page.locator('[role="alert"]')).toHaveCount(0);

  await openCommand(page,'Diagramas/envelopes');
  const post=page.getByTestId('panel-nonlinear-postprocess');await expect(post).toBeVisible();
  const materialNote=page.getByTestId('material-postprocess-note');await expect(materialNote).toContainText('Não linearidade material v0.14');await expect(materialNote).toContainText('fibras escoadas=');await expect(materialNote).toContainText('equilíbrio local N–M');await expect(post).toContainText('0.14.0-exp');
  await post.locator('button[aria-label="Fechar"]').click();

  await openCommand(page,'Relatório técnico');
  const report=page.getByTestId('panel-nonlinear-report');await expect(report).toBeVisible();await expect(report).toContainText('0.14.0-exp');
  const materialReport=page.getByTestId('material-nonlinear-report');await expect(materialReport).toContainText('aço bilinear monotônico');
  const constitutiveMoment=Number(await page.getByTestId('material-hinge-moment').first().textContent());expect(Math.abs(constitutiveMoment-2200)).toBeLessThan(.2);
  await expect(page.getByTestId('material-hinge-yielded').first()).toContainText('/100');
  await expect(page.getByTestId('nonlinear-report-limitations')).toContainText('plasticidade distribuída');
  await expect(page.locator('[role="alert"]')).toHaveCount(0);
});
