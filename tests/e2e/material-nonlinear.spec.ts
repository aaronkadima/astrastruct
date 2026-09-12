import { expect, test, type Page } from '@playwright/test';

async function storedProject(page:Page){
  return page.evaluate(()=>{const raw=localStorage.getItem('astrastruct.project');return raw?JSON.parse(raw):null});
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

async function openInspectorIfNeeded(page:Page){
  const editor=page.getByTestId('fiber-hinge-rz2-enabled');
  if(await editor.isVisible().catch(()=>false))return;
  const inspector=page.locator('button[aria-label="Inspector"]:visible').first();
  if(await inspector.isVisible().catch(()=>false))await inspector.click();
  await expect(editor).toBeVisible();
}

test('v0.14 fiber hinge is configured in Inspector and solved by material nonlinear kernel',async({page})=>{
  await installSteelCantilever(page);
  await expect(page.getByTestId('astra-app')).toBeVisible();
  const canvas=page.getByTestId('model-canvas');await expect(canvas).toBeVisible();const box=await canvas.boundingBox();if(!box)throw new Error('Canvas sem geometria');await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
  await openInspectorIfNeeded(page);

  const enabled=page.getByTestId('fiber-hinge-rz2-enabled');await expect(enabled).toBeEnabled();await enabled.check();
  await page.getByTestId('fiber-hinge-rz2-lp').fill('0.35');
  await page.getByTestId('fiber-hinge-rz2-fibers').fill('100');
  await page.getByTestId('fiber-hinge-rz2-hardening').fill('0.01');
  const apply=page.getByRole('button',{name:'Aplicar alterações'}).last();await apply.click();

  await expect.poll(async()=>{const p=await storedProject(page);const e=p?.elements?.find((x:any)=>x.id==='E1');return [p?.settings?.analysisType,e?.fiberHinges?.rz2?.enabled,Number(e?.fiberHinges?.rz2?.nFibers),Number(e?.fiberHinges?.rz2?.hingeLength),e?.releases?.rz2,e?.rotationalSprings?.rz2]}).toEqual(['corotational',true,100,.35,false,null]);

  await page.getByTestId('analyze-button').click();
  const results=page.locator('.results-content');await expect(results).toBeVisible();
  await expect(results).toContainText('frame2d-corotational-fiber-hinge-experimental');
  await expect(page.getByTestId('nonlinear-result-metric')).toContainText('convergiu');
  await expect(page.getByTestId('deformed-overlay')).toBeVisible();
  await expect(page.locator('[role="alert"]')).toHaveCount(0);
});
