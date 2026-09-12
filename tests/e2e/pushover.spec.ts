import { expect, test, type Page } from '@playwright/test';

async function storedProject(page:Page){return page.evaluate(()=>{const raw=localStorage.getItem('astrastruct.project');return raw?JSON.parse(raw):null})}

async function openCommand(page:Page,label:string){
  const width=page.viewportSize()?.width||1280;
  if(width<=1100){const more=page.locator('button[aria-label="Mais comandos"]:visible').first();await expect(more).toBeVisible();await more.click();const command=page.locator(`.command-sheet button[aria-label="${label}"]:visible`).first();await expect(command).toBeVisible();await command.click();return}
  const direct=page.locator(`button[aria-label="${label}"]:visible`).first();if(await direct.isVisible().catch(()=>false)){await direct.click();return}
  const library=page.locator('.library-tools button').filter({hasText:label}).first();await expect(library).toBeVisible();await library.click();
}

async function installElasticCantilever(page:Page){
  await page.goto('./');
  await page.evaluate(()=>{
    const raw=localStorage.getItem('astrastruct.project');if(!raw)throw new Error('Projeto inicial ausente');const p=JSON.parse(raw),A=.02,I=.00006666666666666667;
    p.name='E2E — pushover v0.16';
    p.materials=[{id:'S',name:'Steel E2E',type:'steel',E:200e6,nu:.3,density:78.5,alpha:12e-6,fy:355,verified:false}];
    p.sections=[{id:'SEC',name:'Retangular E2E',family:'rect',b:.1,h:.2,A,I}];
    p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:2,y:0}];
    p.elements=[{id:'E1',type:'frame2d',n1:'N1',n2:'N2',materialId:'S',sectionId:'SEC',A,I,label:'Cantilever',releases:{rz1:false,rz2:false},rotationalSprings:{rz1:null,rz2:null}}];
    p.supports=[{nodeId:'N1',ux:true,uy:true,rz:true}];
    p.loads=[{id:'L1',caseId:'LC1',nodeId:'N2',fx:0,fy:-10,mz:0}];p.elementLoads=[];p.nodeSprings=[];p.settlements=[];
    p.settings={...(p.settings||{}),analysisType:'linear',activeLoadCaseId:'LC1',analysisScenarioId:'LC1',nonlinearSteps:5,nonlinearMaxIterations:35,nonlinearTolerance:1e-9,nonlinearLineSearch:true,imperfection:{...(p.settings?.imperfection||{}),enabled:false}};
    localStorage.setItem('astrastruct.project',JSON.stringify(p));
  });
  await page.reload();
}

test('v0.16 configures displacement-control pushover and renders capacity curve',async({page})=>{
  await installElasticCantilever(page);await expect(page.getByTestId('astra-app')).toBeVisible();
  await openCommand(page,'Tipo de análise');
  await page.getByTestId('analysis-corotational').click();
  await page.getByTestId('nonlinear-control-mode').selectOption('displacement');
  await expect(page.getByTestId('pushover-control-note')).toBeVisible();
  await page.getByTestId('displacement-control-node').selectOption('N2');
  await page.getByTestId('displacement-control-dof').selectOption('uy');
  await page.getByTestId('displacement-control-target').fill('-0.5');
  await page.getByTestId('displacement-control-tolerance').fill('0.0000001');
  await page.getByTestId('nonlinear-steps').fill('5');
  await page.getByTestId('analysis-apply').click();
  await expect.poll(async()=>{const p=await storedProject(page);return [p?.settings?.analysisType,p?.settings?.nonlinearControlMode,p?.settings?.displacementControlNodeId,p?.settings?.displacementControlDof,Number(p?.settings?.displacementControlTarget),Number(p?.settings?.nonlinearSteps)]}).toEqual(['corotational','displacement','N2','uy',-.0005,5]);

  await page.getByTestId('analyze-button').click();
  const results=page.locator('.results-content');await expect(results).toBeVisible();await expect(results).toContainText('frame2d-corotational-displacement-control-experimental');await expect(page.locator('[role="alert"]')).toHaveCount(0);

  await openCommand(page,'Diagramas/envelopes');
  const post=page.getByTestId('panel-nonlinear-postprocess');await expect(post).toBeVisible();
  await expect(post).toContainText('0.16.0-exp');
  await expect(page.getByTestId('pushover-summary')).toContainText('λ final');
  await expect(page.getByTestId('pushover-capacity-chart')).toBeVisible();
  await expect(page.getByTestId('pushover-peak-marker')).toBeVisible();
  await post.locator('button[aria-label="Fechar"]').click();

  await openCommand(page,'Relatório técnico');
  const report=page.getByTestId('panel-nonlinear-report');await expect(report).toBeVisible();await expect(report).toContainText('0.16.0-exp');await expect(page.getByTestId('pushover-report')).toContainText('Pushover por controle de deslocamento');
  await expect(page.locator('[role="alert"]')).toHaveCount(0);
});
