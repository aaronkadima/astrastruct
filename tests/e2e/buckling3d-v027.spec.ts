import {test,expect} from '@playwright/test';

async function openStability(page:any){
 const topbar=page.locator('.topbar button[aria-label="Estabilidade"]');
 if(await topbar.isVisible()){await topbar.click();return;}
 await page.getByLabel('Mais comandos').click();
 await page.locator('.command-sheet button[aria-label="Estabilidade"]').click();
}

function spatialBucklingProject(){
 const n=6,L=4,E=200e6,A=.01,Iy=6e-5,Iz=9e-5,J=2e-5;
 const nodes=Array.from({length:n+1},(_,i)=>({id:`N${i}`,x:L*i/n,y:0,z:0}));
 const elements=Array.from({length:n},(_,i)=>({id:`E${i}`,type:'frame3d',n1:`N${i}`,n2:`N${i+1}`,materialId:'S',sectionId:'SEC',A,Iy,Iz,J,orientation:{up:[0,1,0]}}));
 return{id:'buckling3d',name:'Buckling 3D',version:13,schemaVersion:2,units:'kN-m-MPa',nodes,elements,materials:[{id:'S',type:'steel',E,nu:.3,density:78.5}],sections:[{id:'SEC',family:'steel3d',A,Iy,Iz,J,I:Iz}],supports:[{nodeId:'N0',ux:true,uy:true,uz:true,rx:true},{nodeId:`N${n}`,uy:true,uz:true}],loads:[{id:'P',caseId:'LC1',nodeId:`N${n}`,fx:-1000}],elementLoads:[],settlements:[],nodeSprings:[],nodalMasses:[],loadCases:[{id:'LC1',name:'Compressão'}],loadCombinations:[],connections:[],settings:{analysisType:'linear',analysisScenarioId:'LC1',activeLoadCaseId:'LC1',grid:.25,snap:true},meta:{}};
}

test('v0.27 visualizes a 3D linear buckling mode in Canvas 3D',async({page})=>{
 const p=spatialBucklingProject();
 await page.addInitScript(x=>localStorage.setItem('astrastruct.project',JSON.stringify(x)),p);await page.goto('./');
 await openStability(page);await expect(page.getByTestId('panel-buckling')).toBeVisible();await page.getByTestId('buckling-calculate').click();await expect(page.getByTestId('buckling-critical-factor')).toBeVisible();
 const factor=Number(await page.getByTestId('buckling-critical-factor').textContent());expect(factor).toBeGreaterThan(0);const canvas=page.getByTestId('spatial-canvas-3d');await expect(canvas).toHaveAttribute('data-shape-kind','buckling');await expect(page.getByTestId('spatial3d-shape-kind')).toContainText('Flambagem');
 await page.getByTestId('panel-buckling').getByLabel('Fechar').click();await expect(page.getByTestId('panel-buckling')).toBeHidden();
 await page.getByTestId('spatial3d-animate').click();await expect(page.getByTestId('spatial3d-animate')).toContainText('Parar');
});

test('v0.29 transfers a 3D buckling mode into P-Delta as modal imperfection',async({page})=>{
 const p=spatialBucklingProject();
 await page.addInitScript(x=>localStorage.setItem('astrastruct.project',JSON.stringify(x)),p);await page.goto('./');
 await openStability(page);await page.getByTestId('buckling-calculate').click();await expect(page.getByTestId('buckling-critical-factor')).toBeVisible();
 await page.getByTestId('imperfection-amplitude').fill('5');
 await expect(page.getByTestId('apply-imperfection')).toContainText('P‑Delta 3D');
 await page.getByTestId('apply-imperfection').click();
 await expect(page.getByTestId('imperfection-active')).toContainText('P‑Delta');
 await page.getByTestId('panel-buckling').getByLabel('Fechar').click();
 await page.getByTestId('analyze-button').click();
 await expect(page.getByTestId('spatial3d-results')).toBeVisible();
 await expect(page.getByTestId('spatial-canvas-3d')).toHaveAttribute('data-shape-kind','deformed');
 await expect(page.getByTestId('spatial3d-shape-kind')).toContainText('total');
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('astrastruct.project')||'{}'));
 expect(saved.settings.analysisType).toBe('pdelta');expect(saved.settings.imperfection.enabled).toBe(true);expect(saved.settings.imperfection.amplitudeMm).toBe(5);
});
