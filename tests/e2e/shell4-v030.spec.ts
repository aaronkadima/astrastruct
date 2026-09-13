import {test,expect} from '@playwright/test';

const project={id:'shell4-e2e',name:'Shell4 E2E',version:13,schemaVersion:2,units:'kN-m-MPa',nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:4,y:0,z:0},{id:'N3',x:4,y:3,z:0},{id:'N4',x:0,y:3,z:0}],elements:[{id:'S1',type:'shell4',nodeIds:['N1','N2','N3','N4'],n1:'N1',n2:'N2',n3:'N3',n4:'N4',materialId:'C',thickness:.2,shearCorrection:5/6,drillingFactor:1e-6,label:'Laje teste'}],materials:[{id:'C',name:'Concreto E2E',type:'concrete',E:30e6,nu:.2,density:25}],sections:[],supports:['N1','N2','N3','N4'].map(nodeId=>({nodeId,ux:true,uy:true,uz:true,rx:true,ry:true,rz:true})),loads:[],elementLoads:[{id:'P1',caseId:'LC1',elementId:'S1',kind:'surface',pressure:-10}],settlements:[],nodeSprings:[],nodalMasses:[],loadCases:[{id:'LC1',name:'Pressão',type:'user'}],loadCombinations:[],connections:[],diaphragms:[],settings:{analysisType:'linear',analysisScenarioId:'LC1',activeLoadCaseId:'LC1',grid:.25,snap:true},meta:{productVersion:'0.30.0',schemaVersion:2}};

async function loadProject(page:any,p:any=project){await page.addInitScript((value:any)=>localStorage.setItem('astrastruct.project',JSON.stringify(value)),p);await page.goto('./')}
async function clickVisible(locator:any){for(const item of await locator.all())if(await item.isVisible()){await item.click();return}throw new Error('Nenhum comando visível encontrado.');}

test('shell4 renders, opens spatial inspector and persists thickness and pressure',async({page})=>{
  await loadProject(page);
  const canvas=page.getByTestId('spatial-canvas-3d');await expect(canvas).toBeVisible();await expect(canvas).toHaveAttribute('data-shell-count','1');
  await page.getByRole('button',{name:'Selecionar elemento S1',exact:true}).click();
  const inspector=page.getByTestId('spatial-inspector-shell');await expect(inspector).toBeVisible();
  await expect(page.getByTestId('shell-thickness')).toHaveValue('0.2');await expect(page.getByTestId('shell-pressure')).toHaveValue('-10');
  await page.getByTestId('shell-thickness').fill('0.22');await page.getByTestId('shell-pressure').fill('-12');await page.getByTestId('shell-apply').click();
  await expect.poll(async()=>page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('astrastruct.project')||'{}'),e=(p.elements||[]).find((x:any)=>x.id==='S1'),l=(p.elementLoads||[]).find((x:any)=>x.elementId==='S1'&&x.kind==='surface');return{t:e?.thickness,p:l?.pressure}})).toEqual({t:.22,p:-12});
});

test('shell4 participates in linear analysis and exposes shell result fields',async({page})=>{
  await loadProject(page);await page.getByTestId('analyze-button').click();await expect(page.getByTestId('spatial3d-results')).toBeVisible();await expect(page.getByTestId('shell4-results')).toBeVisible();
  const field=page.getByLabel('Campo de esforço 3D');await field.selectOption('Nx');await expect(page.getByTestId('spatial-canvas-3d')).toHaveAttribute('data-force-mode','Nx');
  await field.selectOption('Mx');await expect(page.getByTestId('spatial-canvas-3d')).toHaveAttribute('data-force-mode','Mx');
});

test('shell4 can be selected for Modal 3D and produces positive modes',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-chromium','shell4 modal workflow smoke');
  const fixed=(nodeId:string)=>({nodeId,ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}),freeEdge=(nodeId:string)=>({nodeId,ux:true,uy:true,uz:false,rx:false,ry:false,rz:true});
  const modal={...project,id:'shell4-modal',name:'Shell4 modal',supports:[fixed('N1'),freeEdge('N2'),freeEdge('N3'),fixed('N4')],elementLoads:[],settings:{...project.settings,analysisType:'linear',modalModes:4,dynamicMassFormulation:'consistent'}};
  await loadProject(page,modal);
  await clickVisible(page.getByRole('button',{name:'Tipo de análise',exact:true}));
  const modalChoice=page.getByTestId('analysis-modal');await expect(modalChoice).toBeEnabled();await modalChoice.click();
  await expect(page.getByTestId('shell4-modal-mass-note')).toBeVisible();await page.getByTestId('dynamic-mass-formulation').selectOption('consistent');await page.getByTestId('analysis-apply').click();
  await expect.poll(async()=>page.evaluate(()=>JSON.parse(localStorage.getItem('astrastruct.project')||'{}').settings?.analysisType)).toBe('modal');
  await page.getByTestId('analyze-button').click();const results=page.getByTestId('dynamic-results-modal');await expect(results).toBeVisible();await expect(results).toContainText('Hz');
});

test('Model Lab creates a shell4 from four nodes on the same level',async({page})=>{
  const launch={...project,id:'shell4-launch',name:'Shell launcher',elements:[],elementLoads:[],supports:[],levels:[{id:'L0',name:'Pavimento teste',elevation:0,index:0}],nodes:project.nodes.map(n=>({...n,levelId:'L0'}))};
  await loadProject(page,launch);await page.getByTestId('model-lab-launch').click();const tab=page.getByTestId('shell4-lab-tab');await expect(tab).toBeVisible();await tab.click();await expect(page.getByTestId('create-shell4')).toBeVisible();
  await Promise.all([page.waitForEvent('framenavigated'),page.getByTestId('create-shell4').click()]);
  await expect(page.getByTestId('spatial-canvas-3d')).toHaveAttribute('data-shell-count','1');
  await expect.poll(async()=>page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('astrastruct.project')||'{}'),e=(p.elements||[]).find((x:any)=>x.type==='shell4'),l=(p.elementLoads||[]).find((x:any)=>x.elementId===e?.id);return{nodes:e?.nodeIds?.length,unique:new Set(e?.nodeIds||[]).size,t:e?.thickness,p:l?.pressure,mode:p.settings?.analysisType}})).toEqual({nodes:4,unique:4,t:.18,p:-5,mode:'linear'});
});

test('Model Lab refines shell4 into a conforming 2x2 mesh and preserves pressure',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-chromium','shell4 refinement UI smoke');
  const launch={...project,id:'shell4-refine',name:'Shell refine',levels:[{id:'L0',name:'Pavimento teste',elevation:0,index:0}],nodes:project.nodes.map(n=>({...n,levelId:'L0'})),elements:project.elements.map(e=>({...e,levelId:'L0'}))};
  await loadProject(page,launch);await page.getByTestId('model-lab-launch').click();await page.getByTestId('shell4-lab-tab').click();const controls=page.getByTestId('shell4-refinement-controls');await expect(controls).toBeVisible();
  await controls.locator('[data-shell-refine-x]').fill('2');await controls.locator('[data-shell-refine-y]').fill('2');
  await Promise.all([page.waitForEvent('framenavigated'),page.getByTestId('refine-shell4-level').click()]);
  await expect(page.getByTestId('spatial-canvas-3d')).toHaveAttribute('data-shell-count','4');
  await expect.poll(async()=>page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('astrastruct.project')||'{}');return{nodes:p.nodes?.length,shells:(p.elements||[]).filter((e:any)=>e.type==='shell4').length,loads:(p.elementLoads||[]).filter((l:any)=>l.kind==='surface').length,pressures:[...new Set((p.elementLoads||[]).filter((l:any)=>l.kind==='surface').map((l:any)=>l.pressure))],created:p.meta?.lastShellRefinementReport?.createdNodes,areaError:p.meta?.lastShellRefinementReport?.areaRelativeError}})).toMatchObject({nodes:9,shells:4,loads:4,pressures:[-10],created:5});
});

test('Model Lab auto-fills a closed rectangular bay with shell4',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-chromium','automatic shell panel fill smoke');
  const frame=(id:string,n1:string,n2:string)=>({id,type:'frame3d',n1,n2,materialId:'C',sectionId:'SEC',A:.15,Iy:.004,Iz:.004,J:.002});
  const launch={...project,id:'shell4-auto',name:'Auto shell',levels:[{id:'L0',name:'Pavimento teste',elevation:0,index:0}],nodes:project.nodes.map(n=>({...n,levelId:'L0'})),elements:[frame('E1','N1','N2'),frame('E2','N2','N3'),frame('E3','N3','N4'),frame('E4','N4','N1')],sections:[{id:'SEC',name:'Seção E2E',A:.15,Iy:.004,Iz:.004,J:.002,I:.004}],supports:[],elementLoads:[]};
  await loadProject(page,launch);await page.getByTestId('model-lab-launch').click();await page.getByTestId('shell4-lab-tab').click();const auto=page.getByTestId('auto-shell4-panels');await expect(auto).toBeVisible();await expect(auto).toContainText('1 vão');
  await Promise.all([page.waitForEvent('framenavigated'),auto.click()]);await expect(page.getByTestId('spatial-canvas-3d')).toHaveAttribute('data-shell-count','1');
  await expect.poll(async()=>page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('astrastruct.project')||'{}');return{shells:(p.elements||[]).filter((e:any)=>e.type==='shell4').length,surface:(p.elementLoads||[]).filter((l:any)=>l.kind==='surface').length,created:p.meta?.lastShellMeshReport?.created}})).toEqual({shells:1,surface:1,created:1});
});
