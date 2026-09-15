import {test,expect} from '@playwright/test';

const project={id:'shell-adaptive-e2e',name:'Shell adaptive E2E',version:13,schemaVersion:2,units:'kN-m-MPa',nodes:[{id:'N1',x:0,y:0,z:0,levelId:'L0'},{id:'N2',x:4,y:0,z:0,levelId:'L0'},{id:'N3',x:4,y:3,z:0,levelId:'L0'},{id:'N4',x:0,y:3,z:0,levelId:'L0'}],elements:[{id:'S1',type:'shell4',nodeIds:['N1','N2','N3','N4'],n1:'N1',n2:'N2',n3:'N3',n4:'N4',levelId:'L0',materialId:'C',thickness:.2,shearCorrection:5/6,drillingFactor:1e-6,label:'Laje adaptativa'}],materials:[{id:'C',name:'Concreto E2E',type:'concrete',E:30e6,nu:.2,density:25}],sections:[],supports:[{nodeId:'N1',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true},{nodeId:'N4',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}],loads:[],elementLoads:[{id:'P1',caseId:'LC1',elementId:'S1',kind:'surface',pressure:-10}],settlements:[],nodeSprings:[],nodalMasses:[],loadCases:[{id:'LC1',name:'Pressão',type:'user'}],loadCombinations:[],connections:[],diaphragms:[],levels:[{id:'L0',name:'Pavimento teste',elevation:0,index:0}],settings:{analysisType:'linear',analysisScenarioId:'LC1',activeLoadCaseId:'LC1',grid:.25,snap:true},meta:{productVersion:'0.30.0',schemaVersion:2}};

async function loadProject(page:any){await page.addInitScript((value:any)=>{if(!localStorage.getItem('astrastruct.project'))localStorage.setItem('astrastruct.project',JSON.stringify(value))},project);await page.goto('./')}

test('Model Lab estimates and applies recovery-based adaptive shell4 refinement',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-chromium','adaptive shell4 workflow smoke');
  await loadProject(page);await page.evaluate(()=>window.dispatchEvent(new CustomEvent('astrastruct:model-lab-open')));await page.getByTestId('shell4-lab-tab').click();const controls=page.getByTestId('shell4-adaptive-controls');await expect(controls).toBeVisible();
  await controls.locator('[data-adaptive-field]').selectOption('Mx');await controls.locator('[data-adaptive-tol]').fill('200');await controls.locator('[data-adaptive-fraction]').fill('100');
  await page.getByTestId('estimate-shell4-adaptive').click();await expect(controls).toContainText('1 hotspot');await expect(controls).toContainText('2×2: 1');const apply=page.getByTestId('apply-shell4-adaptive');await expect(apply).toBeEnabled();
  // Estimation is non-destructive.
  await expect.poll(async()=>page.evaluate(()=>JSON.parse(localStorage.getItem('astrastruct.project')||'{}').elements?.filter((e:any)=>e.type==='shell4').length)).toBe(1);
  await Promise.all([page.waitForEvent('framenavigated'),apply.click()]);await expect(page.getByTestId('spatial-canvas-3d')).toHaveAttribute('data-shell-count','4');
  await expect.poll(async()=>page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('astrastruct.project')||'{}'),r=p.meta?.lastShellAdaptiveRefinementReport;return{version:p.meta?.productVersion,shells:(p.elements||[]).filter((e:any)=>e.type==='shell4').length,loads:(p.elementLoads||[]).filter((l:any)=>l.kind==='surface').length,applied:r?.applied,marked:r?.markedIds?.length,transitions:r?.transitionIds?.length}})).toMatchObject({shells:4,loads:4,applied:true,marked:1,transitions:0});
});
