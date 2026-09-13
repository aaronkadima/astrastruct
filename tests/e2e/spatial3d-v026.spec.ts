import { test, expect } from '@playwright/test';

test('v0.30 solves a 3D frame and exposes spatial DOFs and forces',async({page})=>{
  const project={id:'p3d',name:'E2E frame 3D',version:13,schemaVersion:2,units:'kN-m-MPa',nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:3,y:1,z:2}],elements:[{id:'E1',type:'frame3d',n1:'N1',n2:'N2',materialId:'S',sectionId:'SEC',A:.01,Iy:7e-5,Iz:9e-5,J:2e-5,orientation:{up:[0,0,1]}}],materials:[{id:'S',type:'steel',E:200e6,nu:.3,density:78.5}],sections:[{id:'SEC',family:'steel3d',A:.01,Iy:7e-5,Iz:9e-5,J:2e-5,I:9e-5}],supports:[{nodeId:'N1',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}],loads:[{id:'L',caseId:'LC1',nodeId:'N2',fx:5,fy:-7,fz:-11,mx:2,my:0,mz:0}],elementLoads:[],settlements:[],nodeSprings:[],nodalMasses:[],loadCases:[{id:'LC1',name:'Caso 1',type:'user'}],loadCombinations:[],connections:[],settings:{analysisType:'linear',analysisScenarioId:'LC1',activeLoadCaseId:'LC1',grid:.25,snap:true},meta:{solverVersion:'0.13.6-exp'}};
  await page.addInitScript(p=>localStorage.setItem('astrastruct.project',JSON.stringify(p)),project);
  await page.goto('./');
  await page.getByTestId('analyze-button').click();
  const result=page.getByTestId('spatial3d-results');await expect(result).toBeVisible();
  await expect(result).toContainText('3D · 6 DOFs/nó');await expect(result).toContainText('0.30.0');
  await expect(page.getByTestId('spatial3d-forces')).toContainText('E1');
});
