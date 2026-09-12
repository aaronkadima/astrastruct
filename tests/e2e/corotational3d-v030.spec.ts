import {test,expect,type Page} from '@playwright/test';

async function openAnalysis(page:Page){
 const width=page.viewportSize()?.width||1280;
 if(width<=1100){const more=page.locator('button[aria-label="Mais comandos"]:visible').first();await expect(more).toBeVisible();await more.click();const cmd=page.locator('.command-sheet button[aria-label="Tipo de análise"]:visible').first();await expect(cmd).toBeVisible();await cmd.click();return;}
 const library=page.locator('.library-tools button').filter({hasText:'Tipo de análise'}).first();await expect(library).toBeVisible();await library.scrollIntoViewIfNeeded();await library.click();
}

test('v0.30 spatial analysis panel enables and runs elastic co-rotational frame3d',async({page})=>{
 const L=3,E=200e6,nu=.3,A=.012,Iy=7e-5,Iz=9e-5,J=1.6e-5;
 const p={id:'corot3d-e2e',name:'Co-rot 3D E2E',version:13,schemaVersion:2,units:'kN-m-MPa',nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:L,y:0,z:0}],elements:[{id:'E1',type:'frame3d',n1:'N1',n2:'N2',materialId:'S',sectionId:'SEC',A,Iy,Iz,J,orientation:{up:[0,1,0]}}],materials:[{id:'S',type:'steel',E,nu,density:78.5}],sections:[{id:'SEC',family:'i',A,Iy,Iz,J,I:Iz}],supports:[{nodeId:'N1',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}],loads:[{id:'P',caseId:'LC1',nodeId:'N2',fx:-120,fy:-3,fz:1}],elementLoads:[],settlements:[],nodeSprings:[],nodalMasses:[],loadCases:[{id:'LC1',name:'Carga espacial'}],loadCombinations:[],connections:[],settings:{analysisType:'linear',analysisScenarioId:'LC1',activeLoadCaseId:'LC1',grid:.25,snap:true,nonlinearSteps:6,nonlinearMaxIterations:30,nonlinearTolerance:1e-8,nonlinearLineSearch:true},meta:{}};
 await page.addInitScript(x=>localStorage.setItem('astrastruct.project',JSON.stringify(x)),p);await page.goto('./');
 await openAnalysis(page);const panel=page.getByTestId('panel-spatial-analysis');await expect(panel).toBeVisible();await expect(page.getByTestId('analysis-modal')).toBeEnabled();await expect(page.getByTestId('analysis-pdelta')).toBeEnabled();await expect(page.getByTestId('analysis-corotational')).toBeEnabled();
 await page.getByTestId('analysis-corotational').click();await expect(page.getByTestId('spatial-corotational-controls')).toBeVisible();await page.getByTestId('analysis-apply').click();await expect(panel).toHaveCount(0);
 await expect.poll(async()=>page.evaluate(()=>JSON.parse(localStorage.getItem('astrastruct.project')||'{}').settings?.analysisType)).toBe('corotational');
 await page.getByTestId('analyze-button').click();const results=page.getByTestId('spatial3d-results');await expect(results).toBeVisible();await expect(results).toContainText('frame3d-corotational');await expect(results).toContainText('0.30.0-exp');await expect(page.getByTestId('spatial3d-nonlinear-metric')).toBeVisible();
 const canvas=page.getByTestId('spatial-canvas-3d');await expect(canvas).toBeVisible();await expect(canvas).toHaveAttribute('data-shape-kind','deformed');
});
