import { expect, test, type Page } from '@playwright/test';

async function storedProject(page:Page){return page.evaluate(()=>{const raw=localStorage.getItem('astrastruct.project');return raw?JSON.parse(raw):null})}
async function openCommand(page:Page,label:string){const width=page.viewportSize()?.width||1280;if(width<=1100){const more=page.locator('button[aria-label="Mais comandos"]:visible').first();await expect(more).toBeVisible();await more.click();const command=page.locator(`.command-sheet button[aria-label="${label}"]:visible`).first();await expect(command).toBeVisible();await command.click();return}const direct=page.locator(`button[aria-label="${label}"]:visible`).first();if(await direct.isVisible().catch(()=>false)){await direct.click();return}const library=page.locator('.library-tools button').filter({hasText:label}).first();await expect(library).toBeVisible();await library.click()}
async function install(page:Page){await page.goto('./');await page.evaluate(()=>{const raw=localStorage.getItem('astrastruct.project');if(!raw)throw new Error('Projeto inicial ausente');const p=JSON.parse(raw),b=.2,h=.4,A=b*h,I=b*h**3/12;p.name='E2E — cyclic concentrated hinge v0.22';p.materials=[{id:'S',name:'S355',type:'steel',E:200e6,nu:.3,density:0,alpha:12e-6,fy:355}];p.sections=[{id:'SEC',name:'Rect',family:'rect',b,h,A,I}];p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:2,y:0}];p.elements=[{id:'E1',type:'frame2d',n1:'N1',n2:'N2',materialId:'S',sectionId:'SEC',A,I,label:'Cyclic hinge beam',releases:{rz1:false,rz2:false},rotationalSprings:{rz1:null,rz2:null}}];p.supports=[{nodeId:'N1',ux:true,uy:true,rz:true}];p.loads=[{id:'P',caseId:'LC1',nodeId:'N2',fx:0,fy:-900,mz:0}];p.elementLoads=[];p.nodeSprings=[];p.settlements=[];p.settings={...(p.settings||{}),analysisType:'linear',activeLoadCaseId:'LC1',analysisScenarioId:'LC1',nonlinearSteps:15,nonlinearMaxIterations:100,nonlinearTolerance:1e-8,materialMaxIterations:50,materialTolerance:1e-5,materialRelaxation:.75,imperfection:{...(p.settings?.imperfection||{}),enabled:false}};localStorage.setItem('astrastruct.project',JSON.stringify(p))});await page.reload()}
async function openInspector(page:Page){const editor=page.getByTestId('fiber-hinge-rz1-enabled'),width=page.viewportSize()?.width||1280;if(width<=1100){const inspector=page.locator('button[aria-label="Inspector"]:visible').first();await expect(inspector).toBeVisible();await inspector.click()}await editor.scrollIntoViewIfNeeded();await expect(editor).toBeVisible()}

test('v0.22 cyclic concentrated hinge commits history and exposes accumulated demand',async({page})=>{
  await install(page);
  const canvas=page.getByTestId('model-canvas');await expect(canvas).toBeVisible();const box=await canvas.boundingBox();if(!box)throw new Error('Canvas sem geometria');await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
  await openInspector(page);
  await page.getByTestId('fiber-hinge-rz1-enabled').check();
  await page.getByTestId('fiber-hinge-rz1-lp').fill('0.35');
  await page.getByTestId('fiber-hinge-rz1-fibers').fill('80');
  await page.getByTestId('fiber-hinge-rz1-hardening').fill('0.01');
  await page.getByTestId('fiber-hinge-rz1-cyclic').check();
  await page.getByTestId('fiber-hinge-rz1-kinematic').fill('1');
  const apply=page.getByRole('button',{name:'Aplicar alterações'}).last();await apply.scrollIntoViewIfNeeded();await apply.click();
  await expect.poll(async()=>{const p=await storedProject(page),e=p?.elements?.find((x:any)=>x.id==='E1'),h=e?.fiberHinges?.rz1;return [p?.settings?.analysisType,p?.settings?.nonlinearControlMode,p?.settings?.cyclicProtocolEnabled,h?.enabled,h?.cyclic,Number(h?.kinematicFraction),Number(h?.nFibers)]}).toEqual(['corotational','displacement',true,true,true,1,80]);
  if((page.viewportSize()?.width||1280)<=1100){const close=page.locator('.inspector-panel.open button[aria-label="Fechar"]:visible').first();if(await close.isVisible().catch(()=>false))await close.click()}
  await openCommand(page,'Tipo de análise');
  await page.getByTestId('analysis-corotational').click();
  await page.getByTestId('nonlinear-control-mode').selectOption('displacement');
  await page.getByTestId('displacement-control-node').selectOption('N2');
  await page.getByTestId('displacement-control-dof').selectOption('uy');
  await page.getByTestId('displacement-control-target').fill('-60');
  const cyc=page.getByTestId('cyclic-protocol-enabled');if(!(await cyc.isChecked()))await cyc.check();
  await page.getByTestId('cyclic-protocol-targets').fill('-60, 60, -60');
  await page.getByTestId('cyclic-steps-per-segment').fill('5');
  await expect(page.getByTestId('cyclic-hinge-path-warning')).toHaveCount(0);
  await page.getByTestId('analysis-apply').click();
  await page.getByTestId('analyze-button').click();
  const results=page.locator('.results-content');await expect(results).toContainText('frame2d-corotational-fiber-hinge-experimental');await expect(page.locator('[role="alert"]')).toHaveCount(0);
  await openCommand(page,'Diagramas/envelopes');
  const post=page.getByTestId('panel-nonlinear-postprocess');await expect(post).toContainText('0.22.0-exp');const materialNote=page.getByTestId('material-postprocess-note');await expect(materialNote).toContainText('cíclica v0.22');await expect(materialNote).toContainText('Bauschinger');await expect(materialNote).toContainText('Edis=');await expect(page.getByTestId('cyclic-hinge-energy')).toBeVisible();await expect(page.getByTestId('cyclic-hinge-plastic-demand')).toBeVisible();await post.locator('button[aria-label="Fechar"]').click();
  await openCommand(page,'Relatório técnico');
  const report=page.getByTestId('panel-nonlinear-report');await expect(report).toContainText('0.22.0-exp');const materialReport=page.getByTestId('material-nonlinear-report');await expect(materialReport).toContainText('v0.22');await expect(materialReport).toContainText('Bauschinger');await expect(materialReport).toContainText('comprometido');await expect(page.getByTestId('material-cyclic-energy')).toBeVisible();await expect(page.getByTestId('nonlinear-report-limitations')).toContainText('fadiga de baixo ciclo');await expect(page.locator('[role="alert"]')).toHaveCount(0);
});
