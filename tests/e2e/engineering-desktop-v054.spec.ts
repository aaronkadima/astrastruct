import{test,expect}from'@playwright/test';

const preview='?engineeringDesktop=1';

test('v0.54 engineering desktop exposes ribbon, model tree, right rail and bottom results',async({page})=>{
  await page.goto(preview);
  await page.waitForFunction(()=>document.documentElement.dataset.astraReady==='true');
  const app=page.getByTestId('astra-app');
  await expect(app).toHaveClass(/engineering-desktop/);
  await expect(app).toHaveAttribute('data-engineering-desktop-preview','true');
  await expect(page.getByTestId('engineering-ribbon')).toBeVisible();
  await expect(page.getByTestId('engineering-results-strip')).toBeVisible();
  const viewport=page.viewportSize();
  if((viewport?.width||1200)>900){
    await expect(page.getByTestId('engineering-model-explorer')).toBeVisible();
    await expect(page.getByTestId('engineering-right-rail')).toBeVisible();
    const canvasBox=await page.locator('.workspace>.viewport').boundingBox();
    const resultsBox=await page.locator('.workspace>.results-panel').boundingBox();
    const workspaceBox=await page.locator('.workspace').boundingBox();
    expect(canvasBox).not.toBeNull();
    expect(resultsBox).not.toBeNull();
    expect(workspaceBox).not.toBeNull();
    expect(canvasBox!.height).toBeGreaterThan(resultsBox!.height);
    expect(canvasBox!.height/workspaceBox!.height).toBeGreaterThan(.50);
    expect(Math.abs(resultsBox!.y-(canvasBox!.y+canvasBox!.height))).toBeLessThan(2);
    await expect(page.getByTestId('engineering-model-explorer').locator('input[value="NBR 6118:2014"]')).toBeVisible();
    await expect(page.getByTestId('engineering-right-rail').getByText(/Vista Lateral/)).toBeVisible();
    await expect(page.getByTestId('engineering-right-rail').getByText(/Vista Inferior/)).toBeVisible();
  }else{
    await expect(page.getByTestId('engineering-model-explorer')).toHaveCount(1);
    await expect(page.getByTestId('engineering-right-rail')).toHaveCount(1);
  }
});

test('v0.54 3D result publishing exposes functional engineering result tabs',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('astrastruct.project',JSON.stringify({id:'v054-e2e',name:'Edifício teste',levels:[{id:'L0',name:'Base',elevation:0},{id:'L1',name:'Pav. 1',elevation:3}],nodes:[{id:'N0',x:0,y:0,z:0,levelId:'L0'},{id:'N1',x:0,y:0,z:3,levelId:'L1'}],supports:[{nodeId:'N0',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}],materials:[{id:'steel355',name:'Aço',type:'steel',E:200e6,nu:.3,density:78.5,fy:355}],sections:[{id:'s',name:'Seção',family:'steel3d',A:.012,Iy:.00018,Iz:.00022,J:.00003,I:.00022}],elements:[{id:'C1',type:'frame3d',n1:'N0',n2:'N1',materialId:'steel355',sectionId:'s',A:.012,Iy:.00018,Iz:.00022,J:.00003}],loads:[{id:'P',caseId:'LC1',nodeId:'N1',fx:5,fy:0,fz:-10}],loadCases:[{id:'LC1',name:'LC1'}],loadCombinations:[],detailing:{reinforcement:{contract:'rebar-schedule/v1',marks:[{id:'A1',location:'Pilar C1',grade:'CA-50',diameterMm:12.5,quantity:4,cutLengthMm:3200,totalLengthM:12.8,totalMassKg:12.63}]}},settings:{analysisType:'linear',analysisScenarioId:'LC1',activeLoadCaseId:'LC1'}})));
  await page.goto(preview);
  await page.waitForFunction(()=>document.documentElement.dataset.astraReady==='true');
  await page.getByTestId('engineering-ribbon-analyze').click();
  const strip=page.getByTestId('engineering-results-strip');
  await expect(strip.getByText('Pav. 1')).toBeVisible({timeout:20000});
  await strip.getByTestId('engineering-result-tab-reactions').click();
  await expect(strip.getByTestId('engineering-reaction-table')).toBeVisible();
  await expect(strip.getByTestId('engineering-reaction-N0')).toBeVisible();
  await strip.getByTestId('engineering-result-tab-forces').click();
  await expect(strip.getByTestId('engineering-bar-force-table')).toBeVisible();
  await strip.getByTestId('engineering-result-tab-nodes').click();
  await expect(strip.getByTestId('engineering-node-displacement-table')).toBeVisible();
  await expect(strip.getByTestId('engineering-displacement-N1')).toBeVisible();
  await strip.getByTestId('engineering-result-tab-rebar').click();
  await expect(strip.getByTestId('engineering-rebar-table')).toBeVisible();
  await expect(strip.getByTestId('engineering-rebar-summary')).toContainText('1 marca(s)');
  const viewport=page.viewportSize();
  if((viewport?.width||1200)>900)await expect(page.getByTestId('engineering-right-rail').getByText(/Detalhamento após análise/)).toBeVisible();
  else await expect(page.getByTestId('engineering-right-rail').getByText(/Detalhamento após análise/)).toHaveCount(1);
});

test('v0.54 Figma workstation controls are connected to real application state',async({page})=>{
  await page.goto('');
  await page.waitForFunction(()=>document.documentElement.dataset.astraReady==='true');
  const viewport=page.viewportSize();
  if((viewport?.width||1200)<=900)return;
  const explorer=page.getByTestId('engineering-model-explorer');
  const search=explorer.getByLabel('Buscar no modelo');
  await search.fill('fundações');
  await expect(explorer.getByText(/Fundações/).first()).toBeVisible();
  await expect(explorer.getByText(/Pavimentos/)).toHaveCount(0);
  await search.fill('');
  await explorer.getByLabel('Buscar no modelo').press('Tab');
  await page.getByRole('button',{name:'Ajuda'}).click();
  await expect(page.getByText('Ajuda · AstraStruct')).toBeVisible();
  await page.getByRole('button',{name:'Fechar ajuda'}).click();
  const strip=page.getByTestId('engineering-results-strip');
  await strip.getByRole('button',{name:'Reações de apoio'}).click();
  await expect(strip).toHaveAttribute('data-result-tab','reactions');
  await strip.getByRole('button',{name:'Deslocamentos em nós'}).click();
  await expect(strip).toHaveAttribute('data-result-tab','nodes');
});
