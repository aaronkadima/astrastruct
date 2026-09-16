import{test,expect}from'@playwright/test';

const preview='?engineeringDesktop=1';

test('v0.54 engineering desktop exposes ribbon, model tree, right rail and bottom results',async({page})=>{
  await page.goto(preview);
  await page.waitForFunction(()=>document.documentElement.dataset.astraReady==='true');
  const app=page.getByTestId('astra-app');
  await expect(app).toHaveClass(/engineering-desktop/);
  await expect(app).toHaveAttribute('data-engineering-desktop-preview','true');
  await expect(page.getByTestId('engineering-ribbon')).toBeVisible();
  await expect(page.getByTestId('engineering-ribbon-ifc')).toBeAttached();
  await expect(page.locator('.eng-ribbon-scenario')).toHaveCount(0);
  await expect(page.locator('.ifc-exchange-trigger')).toHaveCount(0);
  await expect(page.getByTestId('model-lab-launch')).toHaveCount(0);
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

test('v0.54 modeling ribbon creates 2D/3D models and opens launchers and properties',async({page})=>{
  await page.goto(preview);
  await page.waitForFunction(()=>document.documentElement.dataset.astraReady==='true');
  const trigger=page.getByTestId('engineering-ribbon-modeling');
  const openMenu=async()=>{await trigger.click();await expect(page.getByTestId('engineering-modeling-menu')).toBeVisible()};
  const storedProject=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('astrastruct.project')||'{}'));

  await openMenu();
  const menu=page.getByTestId('engineering-modeling-menu');
  const menuBox=await menu.boundingBox(),treeBox=await page.locator('.library-panel').boundingBox();
  expect(menuBox).not.toBeNull();expect(treeBox).not.toBeNull();expect(Math.abs(menuBox!.width-treeBox!.width)).toBeLessThan(1);
  await expect(menu).toContainText('Lançar novo Edifício');
  await expect(menu).toContainText('Modelo 2D');
  await expect(menu).toContainText('Modelo 3D');
  await expect(menu).toContainText('Biblioteca de propriedades');

  await page.getByTestId('engineering-modeling-2d').click();
  await expect(page.getByTestId('engineering-modeling-2d-options')).toContainText('Pórtico 2D');
  await expect(page.getByTestId('engineering-modeling-2d-options')).toContainText('Viga 2D');
  await page.getByTestId('engineering-new-2d').click();
  await expect.poll(async()=>String((await storedProject()).name)).toBe('Novo modelo 2D');
  await expect(page.locator('.engineering-view-title')).toHaveText('Vista 2D');

  await openMenu();await page.getByTestId('engineering-modeling-2d').click();await page.getByTestId('engineering-example-2d-frame').click();
  await expect.poll(async()=>String((await storedProject()).name)).toBe('Pórtico demonstrativo');

  await openMenu();await page.getByTestId('engineering-modeling-3d').click();
  await expect(page.getByTestId('engineering-modeling-3d-options')).toContainText('Pórtico espacial 3D');
  await expect(page.getByTestId('engineering-modeling-3d-options')).toContainText('Edifício RC · 5 pavimentos');
  await page.getByTestId('engineering-new-3d').click();
  await expect.poll(async()=>String((await storedProject()).name)).toBe('Novo modelo 3D');
  await expect(page.locator('.engineering-view-title')).toHaveText('Vista 3D');

  await openMenu();await page.getByTestId('engineering-modeling-3d').click();await page.getByTestId('engineering-example-3d-frame').click();
  await expect.poll(async()=>String((await storedProject()).name)).toBe('Pórtico espacial 3D demonstrativo');
  await expect(page.locator('.engineering-view-title')).toHaveText('Vista 3D');

  await openMenu();await page.getByTestId('engineering-properties-library').click();
  await expect(page.getByTestId('panel-properties')).toBeVisible();
  await page.getByTestId('panel-properties').getByRole('button',{name:'Fechar'}).click();

  await openMenu();await page.getByTestId('engineering-launch-building').click();
  await expect(page.getByTestId('model-lab-overlay')).toBeVisible();
  await expect(page.getByRole('button',{name:'Lançar edifício'})).toHaveClass(/active/);
  await expect(page.getByTestId('generate-grid-building')).toBeVisible();
});

test('v0.54 3D result publishing exposes functional engineering result tabs',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('astrastruct.project',JSON.stringify({id:'v054-e2e',name:'Edifício teste',levels:[{id:'L0',name:'Base',elevation:0},{id:'L1',name:'Pav. 1',elevation:3}],nodes:[{id:'N0',x:0,y:0,z:0,levelId:'L0'},{id:'N1',x:0,y:0,z:3,levelId:'L1'}],supports:[{nodeId:'N0',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}],materials:[{id:'steel355',name:'Aço',type:'steel',E:200e6,nu:.3,density:78.5,fy:355}],sections:[{id:'s',name:'Seção',family:'steel3d',A:.012,Iy:.00018,Iz:.00022,J:.00003,I:.00022}],elements:[{id:'C1',type:'frame3d',n1:'N0',n2:'N1',materialId:'steel355',sectionId:'s',A:.012,Iy:.00018,Iz:.00022,J:.00003}],loads:[{id:'P',caseId:'LC1',nodeId:'N1',fx:5,fy:0,fz:-10}],loadCases:[{id:'LC1',name:'LC1'}],loadCombinations:[],detailing:{reinforcement:{contract:'rebar-schedule/v1',marks:[{id:'A1',location:'Pilar C1',grade:'CA-50',diameterMm:12.5,quantity:4,cutLengthMm:3200,totalLengthM:12.8,totalMassKg:12.63}]}},settings:{analysisType:'linear',analysisScenarioId:'LC1',activeLoadCaseId:'LC1'}})));
  await page.goto(preview);
  await page.waitForFunction(()=>document.documentElement.dataset.astraReady==='true');
  const canvas=page.getByTestId('spatial-canvas-3d'),viewTools=page.locator('.engineering-view-tools'),view3d=page.locator('.engineering-view-3d-controls');
  await expect(page.locator('.engineering-view-combination>span')).toHaveText('Combinação:');
  await expect(page.locator('.engineering-view-scale>span')).toHaveText('Escala:');
  const firstRowMetrics=await page.evaluate(()=>{
    const selectors=['.engineering-view-mode','.engineering-shape-mode','.engineering-view-combination select','.engineering-view-scale select'];
    return selectors.map(selector=>{const element=document.querySelector(selector) as HTMLSelectElement,style=getComputedStyle(element),measure=document.createElement('canvas').getContext('2d')!;measure.font=style.font;const longest=Math.max(...[...element.options].map(option=>measure.measureText(option.text).width));return{selector,width:element.getBoundingClientRect().width,needed:longest+Number.parseFloat(style.paddingLeft)+Number.parseFloat(style.paddingRight)+26}});
  });
  for(const metric of firstRowMetrics)expect(metric.width,`${metric.selector} must show its complete text`).toBeGreaterThanOrEqual(metric.needed);
  expect(firstRowMetrics.map(metric=>Math.round(metric.width))).toEqual([142,88,92,58]);
  await expect(page.getByTestId('spatial3d-toolbar')).toBeHidden();
  await expect(viewTools.locator('[data-view-preset]')).toHaveCount(0);
  await expect(view3d.locator('[data-view-preset]')).toHaveCount(4);
  await expect(view3d.getByTestId('engineering-view-zoom-in')).toHaveCount(1);
  await expect(view3d.getByTestId('engineering-view-zoom-out')).toHaveCount(1);
  expect(await view3d.evaluate(element=>element.parentElement?.firstElementChild===element)).toBe(true);
  const isoBox=await page.getByTestId('engineering-view-iso').boundingBox();expect(isoBox).not.toBeNull();expect(isoBox!.width).toBeGreaterThanOrEqual(27);
  for(const preset of ['xy','xz','yz','iso']){const control=page.getByTestId(`engineering-view-${preset}`);await control.click();await expect(canvas).toHaveAttribute('data-view',preset)}
  const initialZoom=Number(await canvas.getAttribute('data-zoom'));await page.getByTestId('engineering-view-zoom-in').click();await expect.poll(async()=>Number(await canvas.getAttribute('data-zoom'))).toBeGreaterThan(initialZoom);
  const projection=page.getByTestId('engineering-view-projection');await expect(projection).toHaveText('');await expect(projection.locator('svg')).toHaveCount(1);await projection.click();await expect(canvas).toHaveAttribute('data-projection','orthographic');await expect(projection).toHaveAttribute('aria-label','Mudar para projeção em perspectiva');await projection.click();await expect(canvas).toHaveAttribute('data-projection','perspective');await expect(projection).toHaveAttribute('aria-label','Mudar para projeção ortográfica');
  const rotation=page.getByTestId('engineering-view-auto-rotate'),yaw0=Number(await canvas.getAttribute('data-camera-yaw'));await expect(rotation).toHaveText('');await expect(rotation.locator('svg')).toHaveCount(1);await rotation.click();await expect(canvas).toHaveAttribute('data-auto-rotation','true');await expect(rotation).toHaveAttribute('aria-pressed','true');await expect.poll(async()=>Number(await canvas.getAttribute('data-camera-yaw'))).toBeGreaterThan(yaw0+.01);await rotation.click();await expect(canvas).toHaveAttribute('data-auto-rotation','false');await expect(rotation).toHaveAttribute('aria-pressed','false');
  await page.getByTestId('engineering-view-fit').click();await expect(canvas).toHaveAttribute('data-view','iso');
  await page.getByTestId('engineering-ribbon-analyze').click();
  await expect(page.locator('.engineering-view-title')).toHaveText('Vista 3D');
  const animate=page.getByTestId('engineering-view-animation'),settings=page.getByTestId('engineering-view-settings'),coreAnimate=page.getByTestId('spatial3d-animate');
  await expect(canvas).toHaveAttribute('data-animation-mode','deformation');
  await expect(coreAnimate).toBeAttached();await expect(coreAnimate).toBeHidden();await expect(coreAnimate).toHaveAttribute('data-animate-mode','deformation');
  await expect(animate).toBeVisible();await expect(animate).toBeEnabled();await expect(animate).toHaveAttribute('data-animate-mode','deformation');await expect(settings).toBeVisible();
  const toolsBox=await viewTools.boundingBox(),animateBox=await animate.boundingBox(),settingsBox=await settings.boundingBox();expect(toolsBox).not.toBeNull();expect(animateBox).not.toBeNull();expect(settingsBox).not.toBeNull();expect(animateBox!.x).toBeGreaterThanOrEqual(toolsBox!.x);expect(settingsBox!.x+settingsBox!.width).toBeLessThanOrEqual(toolsBox!.x+toolsBox!.width+1);
  await settings.click();await expect(page.getByTestId('workspace-settings-dialog')).toBeVisible();await page.getByTestId('workspace-settings-dialog').getByRole('button',{name:'Concluir'}).click();
  await expect(page.getByTestId('spatial3d-ssi-controls')).toHaveCount(0);
  await expect(page.getByTestId('spatial3d-ssi-status')).toHaveCount(0);
  const help=page.getByTestId('spatial3d-help');
  await expect(help).toBeVisible();
  await expect(help).not.toContainText('Canvas 3D');
  const floating=page.getByTestId('spatial3d-result-controls');await expect(floating).toBeVisible();
  const helpBox=await help.boundingBox(),floatingBox=await floating.boundingBox(),canvasBox=await page.locator('.workspace>.viewport').boundingBox();
  expect(helpBox).not.toBeNull();expect(floatingBox).not.toBeNull();expect(canvasBox).not.toBeNull();
  expect(helpBox!.y-canvasBox!.y).toBeGreaterThanOrEqual(0);expect(helpBox!.y-canvasBox!.y).toBeLessThan(24);
  expect(Math.abs(floatingBox!.y-helpBox!.y)).toBeLessThan(2);expect(Math.abs(floatingBox!.height-helpBox!.height)).toBeLessThan(2);expect(floatingBox!.height).toBeLessThanOrEqual(26);
  await animate.click();await expect(canvas).toHaveAttribute('data-animation-playing','true');await expect(animate.locator('b')).toHaveText('Parar');
  await expect.poll(async()=>Number(await canvas.getAttribute('data-animation-phase'))).toBeLessThan(.95);
  await animate.click();await expect(canvas).toHaveAttribute('data-animation-playing','false');await expect(canvas).toHaveAttribute('data-animation-phase','1.000');
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
  await expect(page.locator('.engineering-view-title')).toHaveText('Vista 2D');
  await expect(explorer).toContainText('Estruturas Metálicas');
  await expect(explorer).toContainText('Obras de Arte Especiais');
  await expect(explorer).toContainText('Lab isolado');
  await expect(explorer).toContainText('Inspeção remota');
  const search=explorer.getByLabel('Buscar no modelo');
  await search.fill('fundações');
  await expect(explorer.getByText(/Fundações/).first()).toBeVisible();
  await expect(explorer.getByText(/Pavimentos/)).toHaveCount(0);
  await search.fill('');
  await explorer.getByText('Lab isolado',{exact:true}).click();
  await explorer.getByTestId('engineering-lab-anchor-pullout').click();
  const lab=page.getByTestId('anchor-pullout-lab');
  await expect(lab).toBeVisible();
  await lab.getByRole('button',{name:'Fechar',exact:true}).click();
  await explorer.getByLabel('Buscar no modelo').press('Tab');
  await page.getByRole('button',{name:'Ajuda'}).click();
  await expect(page.getByText('Ajuda · AstraStruct')).toBeVisible();
  await page.getByRole('button',{name:'Fechar ajuda'}).click();
  await page.getByTestId('engineering-ribbon-ifc').click();
  await expect(page.getByTestId('ifc-exchange-panel')).toBeVisible();
  await page.getByRole('button',{name:'Fechar intercâmbio IFC'}).click();
  const strip=page.getByTestId('engineering-results-strip');
  await strip.getByRole('button',{name:'Reações de apoio'}).click();
  await expect(strip).toHaveAttribute('data-result-tab','reactions');
  await strip.getByRole('button',{name:'Deslocamentos em nós'}).click();
  await expect(strip).toHaveAttribute('data-result-tab','nodes');
});

test('v0.54 nonlinear 3D results animate the converged load path',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('astrastruct.project',JSON.stringify({id:'v054-load-path',name:'Caminho de carga 3D',nodes:[{id:'N0',x:0,y:0,z:0},{id:'N1',x:4,y:0,z:0}],elements:[{id:'E1',type:'frame3d',n1:'N0',n2:'N1',materialId:'S',sectionId:'SEC',orientation:{up:[0,1,0]}}],materials:[{id:'S',type:'steel',E:200e6,nu:.3,density:78.5}],sections:[{id:'SEC',family:'i',A:.02,Iy:7e-5,Iz:8e-5,J:2e-5,I:8e-5}],supports:[{nodeId:'N0',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}],loads:[{id:'TIP',caseId:'LC1',nodeId:'N1',fy:-40}],elementLoads:[],nodeSprings:[],settlements:[],loadCases:[{id:'LC1',name:'Carga espacial'}],loadCombinations:[],settings:{analysisType:'corotational',analysisScenarioId:'LC1',activeLoadCaseId:'LC1',nonlinearSteps:6,nonlinearMaxIterations:40,nonlinearTolerance:2e-8}})));
  await page.goto(preview);
  await page.waitForFunction(()=>document.documentElement.dataset.astraReady==='true');
  await page.getByTestId('engineering-ribbon-analyze').click();
  const canvas=page.getByTestId('spatial-canvas-3d'),animate=page.getByTestId('engineering-view-animation'),coreAnimate=page.getByTestId('spatial3d-animate');
  await expect(canvas).toHaveAttribute('data-animation-mode','load-path');
  await expect(coreAnimate).toBeAttached();await expect(coreAnimate).toBeHidden();
  await expect(animate).toBeVisible();await expect(animate).toBeEnabled();await expect(animate).toHaveAttribute('data-animate-mode','load-path');await expect(animate.locator('b')).toHaveText('Animar');
  expect(await animate.evaluate(el=>el.previousElementSibling?.tagName==='LABEL'&&el.previousElementSibling.textContent?.includes('Escala:'))).toBe(true);
  const animateBox=await animate.boundingBox(),resultsBox=await page.locator('.workspace>.results-panel').boundingBox();
  expect(animateBox).not.toBeNull();expect(resultsBox).not.toBeNull();expect(animateBox!.y+animateBox!.height).toBeLessThanOrEqual(resultsBox!.y);
  await animate.click();
  await expect(canvas).toHaveAttribute('data-animation-playing','true');await expect(animate.locator('b')).toHaveText('Parar');await expect(animate).toHaveAttribute('aria-pressed','true');
  await expect.poll(async()=>Number(await canvas.getAttribute('data-load-path-lambda'))).toBeLessThan(.95);
  await animate.click();
  await expect(canvas).toHaveAttribute('data-animation-playing','false');await expect(animate.locator('b')).toHaveText('Animar');await expect(animate).toHaveAttribute('aria-pressed','false');
  await expect(canvas).toHaveAttribute('data-load-path-lambda','1.000');
});
