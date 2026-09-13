import {test,expect} from '@playwright/test';

const project={id:'canvas3d',name:'Canvas 3D E2E',version:13,schemaVersion:2,units:'kN-m-MPa',nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:0,y:0,z:3},{id:'N3',x:4,y:0,z:3},{id:'N4',x:4,y:2.5,z:3}],elements:[{id:'E1',type:'frame3d',n1:'N1',n2:'N2',materialId:'S',sectionId:'SEC',A:.012,Iy:.00018,Iz:.00022,J:.00003},{id:'E2',type:'frame3d',n1:'N2',n2:'N3',materialId:'S',sectionId:'SEC',A:.012,Iy:.00018,Iz:.00022,J:.00003},{id:'E3',type:'frame3d',n1:'N3',n2:'N4',materialId:'S',sectionId:'SEC',A:.012,Iy:.00018,Iz:.00022,J:.00003,orientation:{up:[0,0,1]}}],materials:[{id:'S',name:'Aço E2E',type:'steel',E:200e6,nu:.3,density:78.5}],sections:[{id:'SEC',name:'Seção espacial E2E',family:'steel3d',A:.012,Iy:.00018,Iz:.00022,J:.00003,I:.00022}],supports:[{nodeId:'N1',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}],loads:[{id:'L',caseId:'LC1',nodeId:'N4',fx:12,fy:-8,fz:-25,mx:2,my:0,mz:1}],elementLoads:[],settlements:[],nodeSprings:[],nodalMasses:[],loadCases:[{id:'LC1',name:'Caso 1',type:'user'}],loadCombinations:[],connections:[],settings:{analysisType:'linear',analysisScenarioId:'LC1',activeLoadCaseId:'LC1',grid:.25,snap:true},meta:{solverVersion:'0.13.6-exp',productVersion:'0.28.0',schemaVersion:2}};

async function loadProject(page:any){await page.addInitScript((p:any)=>localStorage.setItem('astrastruct.project',JSON.stringify(p)),project);await page.goto('./')}
async function select3D(page:any,label:string){const button=page.getByRole('button',{name:label,exact:true});await button.focus();await expect(button).toBeVisible();await button.click()}

test('v0.26.1 renders and operates the spatial Canvas 3D',async({page})=>{
  await loadProject(page);
  const canvas=page.getByTestId('spatial-canvas-3d');await expect(canvas).toBeVisible();await expect(canvas).toHaveAttribute('data-view','iso');
  await page.getByTestId('view-3d-xy').click();await expect(canvas).toHaveAttribute('data-view','xy');
  await page.getByTestId('view-3d-iso').click();await expect(canvas).toHaveAttribute('data-view','iso');
  const z0=Number(await canvas.getAttribute('data-zoom'));await page.getByTestId('spatial3d-zoom-in').click();const z1=Number(await canvas.getAttribute('data-zoom'));expect(z1).toBeGreaterThan(z0);
  await page.getByTestId('spatial3d-projection').click();await expect(canvas).toHaveAttribute('data-projection','orthographic');
  await page.getByTestId('analyze-button').click();await expect(page.getByTestId('spatial3d-results')).toBeVisible();await expect(page.getByTestId('spatial3d-result-controls')).toBeVisible();await expect(page.getByTestId('spatial3d-shape-kind')).toContainText('Deformada');
  await page.getByLabel('Campo de esforço 3D').selectOption('M');await expect(canvas).toHaveAttribute('data-force-mode','M');
});

test('spatial Inspector edits Z, six support DOFs and 3D loads',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-chromium','spatial inspector geometry test');
  await loadProject(page);await select3D(page,'Selecionar nó N2');
  const inspector=page.getByTestId('spatial-inspector-node');await expect(inspector).toBeVisible();
  await expect(page.getByTestId('spatial-node-z')).toHaveValue('3');
  const context=page.getByTestId('context-toolbar');await expect(context).toHaveAttribute('data-context-dimension','3d');await expect(context).toHaveAttribute('data-context-kind','node');
  await context.locator('[data-context-z]').fill('3.2');await context.locator('[data-context-support]').selectOption('fixed3d');
  const fz=context.locator('[data-context-fz]');if(await fz.isVisible())await fz.fill('-7.5');else await page.getByTestId('spatial-load-fz').fill('-7.5');
  await context.getByTestId('context-apply').click();
  await expect(page.getByTestId('spatial-node-z')).toHaveValue('3.2');await expect(page.getByTestId('spatial-load-fz')).toHaveValue('-7.5');
  for(const k of ['ux','uy','uz','rx','ry','rz'])await expect(page.getByTestId(`spatial-support-${k}`)).toBeChecked();
});

test('spatial Inspector persists 3D springs and prescribed support motion',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-chromium','spatial inspector data-entry test');
  await loadProject(page);await select3D(page,'Selecionar nó N2');
  const uzSupport=page.getByTestId('spatial-support-uz'),uzSettlement=page.getByTestId('spatial-settlement-uz');
  await expect(uzSupport).not.toBeChecked();await expect(uzSettlement).toBeDisabled();
  await uzSupport.check();await expect(uzSettlement).toBeEnabled();await uzSettlement.fill('-0.004');
  await page.getByTestId('spatial-spring-kz').fill('250');await page.getByTestId('spatial-spring-krx').fill('1000');
  await page.getByTestId('spatial-node-apply').click();
  await expect.poll(async()=>page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('astrastruct.project')||'{}');const s=(p.nodeSprings||[]).find((x:any)=>x.nodeId==='N2');const st=(p.settlements||[]).find((x:any)=>x.nodeId==='N2'&&x.caseId==='LC1');const sp=(p.supports||[]).find((x:any)=>x.nodeId==='N2');return{uz:sp?.uz,kz:s?.kz,krx:s?.krx,settlement:st?.uz}})).toEqual({uz:true,kz:250,krx:1000,settlement:-.004});
  await expect(page.getByTestId('spatial-spring-kz')).toHaveValue('250');await expect(page.getByTestId('spatial-spring-krx')).toHaveValue('1000');await expect(uzSettlement).toHaveValue('-0.004');
  await uzSupport.uncheck();await expect(uzSettlement).toBeDisabled();await expect(uzSettlement).toHaveValue('0');await page.getByTestId('spatial-node-apply').click();
  await expect.poll(async()=>page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('astrastruct.project')||'{}');const st=(p.settlements||[]).find((x:any)=>x.nodeId==='N2'&&x.caseId==='LC1');return st?.uz??0})).toBe(0);
});

test('spatial Inspector exposes frame3d section and qz properties',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-chromium','spatial inspector geometry test');
  await loadProject(page);await select3D(page,'Selecionar elemento E2');
  const inspector=page.getByTestId('spatial-inspector-element');await expect(inspector).toBeVisible();await expect(page.getByTestId('spatial-iy')).toBeVisible();await expect(page.getByTestId('spatial-iz')).toBeVisible();await expect(page.getByTestId('spatial-j')).toBeVisible();
  const context=page.getByTestId('context-toolbar');await expect(context).toHaveAttribute('data-context-dimension','3d');await expect(context).toHaveAttribute('data-context-kind','element');await expect(context.locator('[data-context-section]')).toBeVisible();await expect(context.locator('[data-context-qz]')).toBeVisible();
  await context.locator('[data-context-qz]').fill('-3.5');await context.getByTestId('context-apply').click();await expect(page.getByTestId('spatial-qz')).toHaveValue('-3.5');
});

test('spatial Inspector persists released and semi-rigid 3D end rotations',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-chromium','spatial connection editor test');
  await loadProject(page);await select3D(page,'Selecionar elemento E2');
  await expect(page.getByTestId('spatial-end-connection-1')).toBeVisible();await expect(page.getByTestId('spatial-end-connection-2')).toBeVisible();
  await page.getByTestId('spatial-release-rz2').check();await page.getByTestId('spatial-rot-spring-ry2').fill('3200');await page.getByTestId('spatial-element-apply').click();
  await expect.poll(async()=>page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('astrastruct.project')||'{}');const e=(p.elements||[]).find((x:any)=>x.id==='E2');return{release:e?.releases?.rz2,rz2:e?.rotationalSprings?.rz2,ry2:e?.rotationalSprings?.ry2}})).toEqual({release:true,rz2:0,ry2:3200});
  await expect(page.getByTestId('spatial-release-rz2')).toBeChecked();await expect(page.getByTestId('spatial-rot-spring-rz2')).toBeDisabled();await expect(page.getByTestId('spatial-rot-spring-ry2')).toHaveValue('3200');
});
