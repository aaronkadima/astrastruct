import { expect, test, type Page } from '@playwright/test';

async function storedProject(page:Page){return page.evaluate(()=>{const raw=localStorage.getItem('astrastruct.project');return raw?JSON.parse(raw):null})}
async function openCommand(page:Page,label:string){const width=page.viewportSize()?.width||1280;if(width<=1100){const more=page.locator('button[aria-label="Mais comandos"]:visible').first();await expect(more).toBeVisible();await more.click();const command=page.locator(`.command-sheet button[aria-label="${label}"]:visible`).first();await expect(command).toBeVisible();await command.click();return}const direct=page.locator(`button[aria-label="${label}"]:visible`).first();if(await direct.isVisible().catch(()=>false)){await direct.click();return}const library=page.locator('.library-tools button').filter({hasText:label}).first();await expect(library).toBeVisible();await library.click()}
async function installDynamicBar(page:Page){await page.goto('./');await page.evaluate(()=>{const raw=localStorage.getItem('astrastruct.project');if(!raw)throw new Error('Projeto inicial ausente');const p=JSON.parse(raw);p.name='E2E — dynamics v0.23';p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:2,y:0}];p.elements=[{id:'T1',type:'truss2d',n1:'N1',n2:'N2',materialId:'S',sectionId:'TR',A:.01,I:0,label:'Axial dynamic bar'}];p.materials=[{id:'S',name:'Steel',type:'steel',E:200e6,nu:.3,density:78.5,alpha:12e-6,fy:355}];p.sections=[{id:'TR',name:'Truss',family:'truss',A:.01,I:0}];p.supports=[{nodeId:'N1',ux:true,uy:true,rz:true},{nodeId:'N2',ux:false,uy:true,rz:false}];p.loads=[{id:'P',caseId:'LC1',nodeId:'N2',fx:10,fy:0,mz:0}];p.elementLoads=[];p.nodeSprings=[];p.nodalMasses=[{id:'M2',nodeId:'N2',mx:.25,my:0,mr:0}];p.settlements=[];p.loadCases=[{id:'LC1',name:'Dynamic pattern',type:'user'}];p.loadCombinations=[];p.settings={...(p.settings||{}),analysisType:'linear',activeLoadCaseId:'LC1',analysisScenarioId:'LC1',dynamicMassFormulation:'consistent',modalModes:3,dynamicDampingRatio:.02,dynamicRayleighMode1:1,dynamicRayleighMode2:1,dynamicTimeStep:.002,dynamicDuration:.2,dynamicMonitorNodeId:'N2',dynamicMonitorDof:'ux',dynamicHistoryPoints:[{t:0,scale:0},{t:.04,scale:1},{t:.12,scale:-.5},{t:.2,scale:0}],imperfection:{...(p.settings?.imperfection||{}),enabled:false}};localStorage.setItem('astrastruct.project',JSON.stringify(p))});await page.reload()}

test('v0.23 modal and time-history workflow exposes frequencies, participation and Newmark history',async({page})=>{
  await installDynamicBar(page);

  await openCommand(page,'Tipo de análise');
  await page.getByTestId('analysis-modal').click();
  await expect(page.getByTestId('dynamic-controls')).toBeVisible();
  await page.getByTestId('dynamic-mass-formulation').selectOption('consistent');
  await page.getByTestId('modal-mode-count').fill('3');
  await expect(page.getByTestId('dynamic-incompatibilities')).toHaveCount(0);
  await page.getByTestId('analysis-apply').click();
  await expect.poll(async()=>{const p=await storedProject(page);return [p?.settings?.analysisType,p?.settings?.dynamicMassFormulation,Number(p?.settings?.modalModes),Number(p?.nodalMasses?.find((m:any)=>m.nodeId==='N2')?.mx)]}).toEqual(['modal','consistent',3,.25]);
  await page.getByTestId('analyze-button').click();
  const modalResults=page.getByTestId('dynamic-results-modal');await expect(modalResults).toBeVisible();await expect(modalResults).toContainText('dynamic-modal2d');await expect(modalResults).toContainText('Hz');await expect(page.locator('[role="alert"]')).toHaveCount(0);
  await openCommand(page,'Diagramas/envelopes');
  const modalPost=page.getByTestId('panel-dynamics-postprocess');await expect(modalPost).toContainText('Dinâmica estrutural · v0.23');await expect(page.getByTestId('dynamic-first-frequency')).toBeVisible();await expect(page.getByTestId('dynamic-modal-table')).toContainText('Mef,X');await modalPost.locator('button[aria-label="Fechar"]').click();

  await openCommand(page,'Tipo de análise');
  await page.getByTestId('analysis-time-history').click();
  await expect(page.getByTestId('dynamic-controls')).toBeVisible();
  await page.getByTestId('dynamic-damping-ratio').fill('0.02');
  await page.getByTestId('dynamic-rayleigh-mode-1').fill('1');
  await page.getByTestId('dynamic-rayleigh-mode-2').fill('1');
  await page.getByTestId('dynamic-time-step').fill('0.002');
  await page.getByTestId('dynamic-duration').fill('0.2');
  await page.getByTestId('dynamic-monitor-node').selectOption('N2');
  await page.getByTestId('dynamic-monitor-dof').selectOption('ux');
  await page.getByTestId('dynamic-history-points').fill('0:0, 0.04:1, 0.12:-0.5, 0.20:0');
  await expect(page.getByTestId('dynamic-incompatibilities')).toHaveCount(0);
  await page.getByTestId('analysis-apply').click();
  await expect.poll(async()=>{const p=await storedProject(page);return [p?.settings?.analysisType,Number(p?.settings?.dynamicTimeStep),Number(p?.settings?.dynamicDuration),p?.settings?.dynamicMonitorNodeId,p?.settings?.dynamicMonitorDof,p?.settings?.dynamicHistoryPoints?.length]}).toEqual(['time-history',.002,.2,'N2','ux',4]);
  await page.getByTestId('analyze-button').click();
  const timeResults=page.getByTestId('dynamic-results-time');await expect(timeResults).toBeVisible();await expect(timeResults).toContainText('N2/UX');await expect(timeResults).toContainText('mm');await expect(page.locator('[role="alert"]')).toHaveCount(0);
  await openCommand(page,'Diagramas/envelopes');
  const timePost=page.getByTestId('panel-dynamics-postprocess');await expect(timePost).toContainText('Newmark-β');await expect(page.getByTestId('dynamic-time-chart')).toBeVisible();await expect(page.getByTestId('dynamic-peak-displacement')).toBeVisible();await expect(page.getByTestId('dynamic-time-summary')).toContainText('Rayleigh');await expect(timePost).toContainText('Aceleração de base ainda não está implementada');await expect(page.locator('[role="alert"]')).toHaveCount(0);
});
