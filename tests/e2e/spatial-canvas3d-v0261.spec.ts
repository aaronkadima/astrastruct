import {test,expect} from '@playwright/test';

test('v0.26.1 renders and operates the spatial Canvas 3D',async({page})=>{
  const project={id:'canvas3d',name:'Canvas 3D E2E',version:13,schemaVersion:2,units:'kN-m-MPa',nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:0,y:0,z:3},{id:'N3',x:4,y:0,z:3},{id:'N4',x:4,y:2.5,z:3}],elements:[{id:'E1',type:'frame3d',n1:'N1',n2:'N2',materialId:'S',sectionId:'SEC',A:.012,Iy:.00018,Iz:.00022,J:.00003},{id:'E2',type:'frame3d',n1:'N2',n2:'N3',materialId:'S',sectionId:'SEC',A:.012,Iy:.00018,Iz:.00022,J:.00003},{id:'E3',type:'frame3d',n1:'N3',n2:'N4',materialId:'S',sectionId:'SEC',A:.012,Iy:.00018,Iz:.00022,J:.00003,orientation:{up:[0,0,1]}}],materials:[{id:'S',type:'steel',E:200e6,nu:.3,density:78.5}],sections:[{id:'SEC',family:'steel3d',A:.012,Iy:.00018,Iz:.00022,J:.00003,I:.00022}],supports:[{nodeId:'N1',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}],loads:[{id:'L',caseId:'LC1',nodeId:'N4',fx:12,fy:-8,fz:-25,mx:2,my:0,mz:1}],elementLoads:[],settlements:[],nodeSprings:[],nodalMasses:[],loadCases:[{id:'LC1',name:'Caso 1',type:'user'}],loadCombinations:[],connections:[],settings:{analysisType:'linear',analysisScenarioId:'LC1',activeLoadCaseId:'LC1',grid:.25,snap:true},meta:{solverVersion:'0.13.6-exp'}};
  await page.addInitScript(p=>localStorage.setItem('astrasuct.project',JSON.stringify(p)),project).catch(()=>{});
  await page.addInitScript(p=>localStorage.setItem('astrastruct.project',JSON.stringify(p)),project);
  await page.goto('./');
  const canvas=page.getByTestId('spatial-canvas-3d');await expect(canvas).toBeVisible();await expect(canvas).toHaveAttribute('data-view','iso');
  await page.getByTestId('view-3d-xy').click();await expect(canvas).toHaveAttribute('data-view','xy');
  await page.getByTestId('view-3d-iso').click();await expect(canvas).toHaveAttribute('data-view','iso');
  const z0=Number(await canvas.getAttribute('data-zoom'));await page.getByTestId('spatial3d-zoom-in').click();const z1=Number(await canvas.getAttribute('data-zoom'));expect(z1).toBeGreaterThan(z0);
  await page.getByTestId('spatial3d-projection').click();await expect(canvas).toHaveAttribute('data-projection','orthographic');
  await page.getByTestId('analyze-button').click();await expect(page.getByTestId('spatial3d-results')).toBeVisible();await expect(page.getByTestId('spatial3d-result-controls')).toBeVisible();await expect(page.getByTestId('spatial3d-shape-kind')).toContainText('Deformada');
  await page.getByLabel('Campo de esforço 3D').selectOption('M');await expect(canvas).toHaveAttribute('data-force-mode','M');
});
