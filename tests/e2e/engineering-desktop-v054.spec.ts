import{test,expect}from'@playwright/test';

test('v0.54 engineering desktop exposes ribbon, model tree, right rail and bottom results',async({page})=>{
  await page.goto('');
  await page.waitForFunction(()=>document.documentElement.dataset.astraReady==='true');
  const app=page.getByTestId('astra-app');
  await expect(app).toHaveClass(/engineering-desktop/);
  await expect(page.getByTestId('engineering-ribbon')).toBeVisible();
  await expect(page.getByTestId('engineering-results-strip')).toBeVisible();
  const viewport=page.viewportSize();
  if((viewport?.width||1200)>900){
    await expect(page.getByTestId('engineering-model-explorer')).toBeVisible();
    await expect(page.getByTestId('engineering-right-rail')).toBeVisible();
    await expect(page.getByText('NBR 6118:2023').first()).toBeVisible();
    await expect(page.getByText(/Fundação visível/)).toBeVisible();
    await expect(page.getByText(/Detalhamento condicionado à análise/)).toBeVisible();
  }else{
    await expect(page.getByTestId('engineering-model-explorer')).toHaveCount(1);
    await expect(page.getByTestId('engineering-right-rail')).toHaveCount(1);
  }
});

test('v0.54 3D result publishing keeps shell/foundation visualization contract available',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('astrastruct.project',JSON.stringify({id:'v054-e2e',name:'Edifício teste',levels:[{id:'L0',name:'Base',elevation:0},{id:'L1',name:'Pav. 1',elevation:3}],nodes:[{id:'N0',x:0,y:0,z:0,levelId:'L0'},{id:'N1',x:0,y:0,z:3,levelId:'L1'}],supports:[{nodeId:'N0',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}],materials:[{id:'steel355',name:'Aço',type:'steel',E:200e6,nu:.3,density:78.5,fy:355}],sections:[{id:'s',name:'Seção',family:'steel3d',A:.012,Iy:.00018,Iz:.00022,J:.00003,I:.00022}],elements:[{id:'C1',type:'frame3d',n1:'N0',n2:'N1',materialId:'steel355',sectionId:'s',A:.012,Iy:.00018,Iz:.00022,J:.00003}],loads:[{id:'P',caseId:'LC1',nodeId:'N1',fx:5,fy:0,fz:-10}],loadCases:[{id:'LC1',name:'LC1'}],loadCombinations:[],settings:{analysisType:'linear',analysisScenarioId:'LC1',activeLoadCaseId:'LC1'}})));
  await page.goto('');
  await page.waitForFunction(()=>document.documentElement.dataset.astraReady==='true');
  await page.getByTestId('engineering-ribbon-analyze').click();
  await expect(page.getByTestId('engineering-results-strip').getByText('Pav. 1')).toBeVisible({timeout:20000});
  const viewport=page.viewportSize();
  if((viewport?.width||1200)>900)await expect(page.getByTestId('engineering-right-rail').getByText(/Detalhamento após análise/)).toBeVisible();
  else await expect(page.getByTestId('engineering-right-rail').getByText(/Detalhamento após análise/)).toHaveCount(1);
});
