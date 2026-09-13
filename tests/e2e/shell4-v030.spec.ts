import {test,expect} from '@playwright/test';

const project={id:'shell4-e2e',name:'Shell4 E2E',version:13,schemaVersion:2,units:'kN-m-MPa',nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:4,y:0,z:0},{id:'N3',x:4,y:3,z:0},{id:'N4',x:0,y:3,z:0}],elements:[{id:'S1',type:'shell4',nodeIds:['N1','N2','N3','N4'],n1:'N1',n2:'N2',n3:'N3',n4:'N4',materialId:'C',thickness:.2,shearCorrection:5/6,drillingFactor:1e-6,label:'Laje teste'}],materials:[{id:'C',name:'Concreto E2E',type:'concrete',E:30e6,nu:.2,density:25}],sections:[],supports:['N1','N2','N3','N4'].map(nodeId=>({nodeId,ux:true,uy:true,uz:true,rx:true,ry:true,rz:true})),loads:[],elementLoads:[{id:'P1',caseId:'LC1',elementId:'S1',kind:'surface',pressure:-10}],settlements:[],nodeSprings:[],nodalMasses:[],loadCases:[{id:'LC1',name:'Pressão',type:'user'}],loadCombinations:[],connections:[],diaphragms:[],settings:{analysisType:'linear',analysisScenarioId:'LC1',activeLoadCaseId:'LC1',grid:.25,snap:true},meta:{productVersion:'0.30.0',schemaVersion:2}};

async function loadProject(page:any,p:any=project){await page.addInitScript((value:any)=>localStorage.setItem('astrastruct.project',JSON.stringify(value)),p);await page.goto('./')}

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

test('Model Lab creates a shell4 from four nodes on the same level',async({page})=>{
  const launch={...project,id:'shell4-launch',name:'Shell launcher',elements:[],elementLoads:[],supports:[],levels:[{id:'L0',name:'Pavimento teste',elevation:0,index:0}],nodes:project.nodes.map(n=>({...n,levelId:'L0'}))};
  await loadProject(page,launch);await page.getByTestId('model-lab-launch').click();const tab=page.getByTestId('shell4-lab-tab');await expect(tab).toBeVisible();await tab.click();await expect(page.getByTestId('create-shell4')).toBeVisible();
  await Promise.all([page.waitForEvent('framenavigated'),page.getByTestId('create-shell4').click()]);
  await expect(page.getByTestId('spatial-canvas-3d')).toHaveAttribute('data-shell-count','1');
  await expect.poll(async()=>page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('astrastruct.project')||'{}'),e=(p.elements||[]).find((x:any)=>x.type==='shell4'),l=(p.elementLoads||[]).find((x:any)=>x.elementId===e?.id);return{nodes:e?.nodeIds?.length,unique:new Set(e?.nodeIds||[]).size,t:e?.thickness,p:l?.pressure,mode:p.settings?.analysisType}})).toEqual({nodes:4,unique:4,t:.18,p:-5,mode:'linear'});
});
