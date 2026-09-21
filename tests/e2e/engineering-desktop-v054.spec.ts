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
  const open=page.locator('[data-eng-top="open"]'),save=page.locator('[data-eng-top="save"]');
  await expect(open).toBeVisible();await expect(open).toContainText('Abrir');expect(await open.evaluate((element,saveElement)=>Boolean(element.compareDocumentPosition(saveElement as Node)&Node.DOCUMENT_POSITION_FOLLOWING),await save.elementHandle())).toBe(true);
  const chooserPromise=page.waitForEvent('filechooser');await open.click();await chooserPromise;
  const footer=page.locator('.engineering-footer');await expect(footer).toBeVisible();await expect(footer).toContainText('Projeto:');await expect(page.locator('.mobile-dock')).toBeHidden();
  const footerBox=await footer.boundingBox(),appBox=await app.boundingBox();expect(footerBox).not.toBeNull();expect(appBox).not.toBeNull();expect(Math.abs(footerBox!.y+footerBox!.height-(appBox!.y+appBox!.height))).toBeLessThan(2);
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
    await expect(page.getByTestId('engineering-model-explorer').locator('input[value="NBR 6118:2023"]')).toBeVisible();
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
  await expect(page.getByText('Seções de pilares e vigas')).toBeVisible();
  await expect(page.getByText('Condições de contorno e pavimentos')).toBeVisible();
  await expect(page.getByText('Fundação',{exact:true})).toBeVisible();
  await expect(page.locator('[data-g-col-b]')).toHaveValue('40');
  await expect(page.locator('[data-g-beam-y-h]')).toHaveValue('60');
  await expect(page.locator('[data-g-analysis]')).toHaveValue('linear');
  await expect(page.locator('[data-g-support]')).toHaveValue('fixed');
  await expect(page.locator('[data-g-diaphragm]')).toHaveValue('semiRigid');
  await expect(page.locator('[data-g-spring-kx]')).toBeDisabled();
  expect(await page.locator('[data-g-analysis] option[value="pdelta"]').evaluate((o:HTMLOptionElement)=>o.disabled)).toBe(true);
  await page.locator('[data-g-slabs]').uncheck();
  expect(await page.locator('[data-g-analysis] option[value="pdelta"]').evaluate((o:HTMLOptionElement)=>o.disabled)).toBe(false);
  await page.locator('[data-g-analysis]').selectOption('corotational');
  await expect(page.locator('[data-g-diaphragm]')).toHaveValue('none');
  expect(await page.locator('[data-g-diaphragm] option[value="rigid"]').evaluate((o:HTMLOptionElement)=>o.disabled)).toBe(true);
  await page.locator('[data-g-analysis]').selectOption('pdelta');
  await expect(page.locator('[data-g-analysis]')).toHaveValue('pdelta');
  expect(await page.locator('[data-g-diaphragm] option[value="rigid"]').evaluate((o:HTMLOptionElement)=>o.disabled)).toBe(false);
  await page.locator('[data-g-support]').selectOption('elastic');
  await expect(page.locator('[data-g-spring-kx]')).toBeEnabled();
  await expect(page.locator('[data-g-spring-kz]')).toBeEnabled();
  await page.locator('[data-g-support]').selectOption('fixed');
  await expect(page.locator('[data-g-spring-kx]')).toBeDisabled();
  await page.locator('[data-g-slabs]').check();
  await expect(page.locator('[data-g-analysis]')).toHaveValue('linear');
  await page.locator('[data-g-diaphragm]').selectOption('rigid');
  const actionsSection=page.getByText('Ações iniciais',{exact:true}).locator('..');
  await actionsSection.locator('summary').click();
  await page.locator('[data-g-load-x]').fill('5');
  await page.locator('[data-g-foundation]').selectOption('pileCap');
  await expect(page.locator('[data-g-pile-count]')).toBeEnabled();
  await page.locator('[data-g-storeys]').fill('2');
  await page.locator('[data-g-x]').fill('4');
  await page.locator('[data-g-y]').fill('3');
  await page.locator('[data-g-col-b]').fill('35');
  await page.locator('[data-g-col-h]').fill('65');
  await page.locator('[data-g-beam-b]').fill('25');
  await page.locator('[data-g-beam-h]').fill('55');
  await page.locator('[data-g-beam-y-b]').fill('30');
  await page.locator('[data-g-beam-y-h]').fill('50');
  await page.locator('[data-g-slab-t]').fill('18');
  await page.locator('[data-g-pile-count]').selectOption('4');
  await page.locator('[data-g-pile-d]').fill('45');
  await page.locator('[data-g-pile-len]').fill('10');
  await page.locator('[data-g-pile-spacing]').fill('1.35');
  await page.getByTestId('generate-grid-building').click();
  await expect.poll(async()=>String((await storedProject()).meta?.launcherConfig?.foundation?.type)).toBe('pileCap');
  await expect.poll(async()=>String((await storedProject()).settings?.analysisType)).toBe('linear');
  const launched=await storedProject();
  expect(launched.meta.launcherConfig.sections.column).toEqual({b:.35,h:.65});
  expect(launched.meta.launcherConfig.sections.beamX).toEqual({b:.25,h:.55});
  expect(launched.meta.launcherConfig.sections.beamY).toEqual({b:.30,h:.50});
  expect(launched.meta.launcherConfig.boundary).toMatchObject({base:'fixed',top:'free'});
  expect(launched.meta.launcherConfig.diaphragmMode).toBe('rigid');
  expect(launched.diaphragms).toHaveLength(2);
  expect(launched.loadCases.map((x:any)=>x.id)).toEqual(['LC1','LX']);
  expect(launched.settings.analysisScenarioId).toBe('SERV_X');
  expect(launched.foundationReview.items.length).toBe(launched.supports.length);
  expect(launched.foundationReview.items.every((item:any)=>item.type==='pileCap'&&item.piles.length===4&&item.piles.every((pile:any)=>pile.diameter===.45&&pile.length===10))).toBe(true);
  await page.getByTestId('engineering-ribbon-analyze').click();
  await expect(page.locator('.error-banner')).toHaveCount(0);
  await expect(page.locator('.eng-footer-state')).toContainText('Análise concluída com sucesso.');
  await expect(page.getByTestId('engineering-ux-load-diagnostic')).toContainText('HX ativo no cenário');
  await expect(page.getByTestId('engineering-ux-load-diagnostic')).not.toContainText('|Ux|max = 0.0000 mm');
  await expect(page.getByTestId('engineering-result-tab-nodes')).toBeVisible();
  await page.getByTestId('engineering-result-tab-nodes').click();
  await expect(page.locator('[data-testid^="engineering-displacement-"]').first()).toBeVisible();

  // Regression: projects saved by the previous launcher could retain P-Delta
  // while shell4 slabs were active. They must self-repair on Analyze.
  await page.evaluate(()=>{
    const key='astrastruct.project',p=JSON.parse(localStorage.getItem(key)||'{}');
    p.settings={...(p.settings||{}),analysisType:'pdelta'};
    p.meta={...(p.meta||{}),launcherConfig:{...(p.meta?.launcherConfig||{}),analysisType:'pdelta'}};
    localStorage.setItem(key,JSON.stringify(p));
  });
  await page.reload();
  await page.waitForFunction(()=>document.documentElement.dataset.astraReady==='true');
  await expect.poll(async()=>String((await storedProject()).settings?.analysisType)).toBe('pdelta');
  await page.getByTestId('engineering-ribbon-analyze').click();
  await expect(page.locator('.error-banner')).toHaveCount(0);
  await expect(page.locator('.analysis-compatibility-note')).toContainText('foi ajustado para Linear 3D');
  await expect(page.locator('.eng-footer-state')).toContainText('Análise concluída com sucesso.');
  await expect.poll(async()=>String((await storedProject()).settings?.analysisType)).toBe('linear');
});

test('v0.54 3D result publishing exposes functional engineering result tabs',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('astrastruct.project',JSON.stringify({id:'v054-e2e',name:'Edifício teste',levels:[{id:'L0',name:'Base',elevation:0},{id:'L1',name:'Pav. 1',elevation:3}],nodes:[{id:'N0',x:0,y:0,z:0,levelId:'L0'},{id:'N1',x:0,y:0,z:3,levelId:'L1'}],supports:[{nodeId:'N0',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}],materials:[{id:'steel355',name:'Aço',type:'steel',E:200e6,nu:.3,density:78.5,fy:355}],sections:[{id:'s',name:'Seção',family:'steel3d',A:.012,Iy:.00018,Iz:.00022,J:.00003,I:.00022}],elements:[{id:'C1',type:'frame3d',n1:'N0',n2:'N1',materialId:'steel355',sectionId:'s',A:.012,Iy:.00018,Iz:.00022,J:.00003}],loads:[{id:'P',caseId:'LC1',nodeId:'N1',fx:5,fy:0,fz:-10}],loadCases:[{id:'LC1',name:'LC1'}],loadCombinations:[],detailing:{reinforcement:{contract:'rebar-schedule/v1',marks:[{id:'A1',location:'Pilar C1',grade:'CA-50',diameterMm:12.5,quantity:4,cutLengthMm:3200,totalLengthM:12.8,totalMassKg:12.63}]}},settings:{analysisType:'linear',analysisScenarioId:'LC1',activeLoadCaseId:'LC1'}})));
  await page.goto(preview);
  await page.waitForFunction(()=>document.documentElement.dataset.astraReady==='true');
  const canvas=page.getByTestId('spatial-canvas-3d'),vector=page.getByTestId('spatial3d-vector-scene'),viewTools=page.locator('.engineering-view-tools'),view3d=page.locator('.engineering-view-3d-controls');
  const shapeMode=page.locator('.engineering-shape-mode');await expect(shapeMode).toBeDisabled();await expect(shapeMode).toHaveValue('reference');await expect(shapeMode.locator('option')).toHaveText(['Deformada','Original','Ambos']);
  await expect(page.locator('.engineering-view-combination>span')).toHaveText('Combinação:');
  await expect(page.locator('.engineering-view-scale>span')).toHaveText('Escala:');
  const firstRowMetrics=await page.evaluate(()=>{
    const selectors=['.engineering-view-mode','.engineering-shape-mode','.engineering-view-combination select','.engineering-view-scale select'];
    return selectors.map(selector=>{const element=document.querySelector(selector) as HTMLSelectElement,style=getComputedStyle(element),measure=document.createElement('canvas').getContext('2d')!;measure.font=style.font;const longest=Math.max(...[...element.options].map(option=>measure.measureText(option.text).width));return{selector,width:element.getBoundingClientRect().width,needed:longest+Number.parseFloat(style.paddingLeft)+Number.parseFloat(style.paddingRight)+26}});
  });
  for(const metric of firstRowMetrics)expect(metric.width,`${metric.selector} must show its complete text`).toBeGreaterThanOrEqual(metric.needed);
  firstRowMetrics.forEach((metric,index)=>expect(metric.width).toBeGreaterThanOrEqual([154,96,96,62][index]));
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
  await expect(shapeMode).toBeEnabled();await expect(shapeMode).toHaveValue('both');
  await shapeMode.selectOption('deformed');await expect(canvas).toHaveAttribute('data-show-deformed','true');await expect(canvas).toHaveAttribute('data-show-reference','false');await expect(canvas).toHaveAttribute('data-show-original','false');
  await shapeMode.selectOption('reference');await expect(canvas).toHaveAttribute('data-show-deformed','false');await expect(canvas).toHaveAttribute('data-show-reference','true');await expect(canvas).toHaveAttribute('data-show-original','true');
  await shapeMode.selectOption('both');await expect(canvas).toHaveAttribute('data-show-deformed','true');await expect(canvas).toHaveAttribute('data-show-reference','true');
  const animate=page.getByTestId('engineering-view-animation'),settings=page.getByTestId('engineering-view-settings'),coreAnimate=page.getByTestId('spatial3d-animate');
  await expect(canvas).toHaveAttribute('data-animation-mode','deformation');
  await expect(coreAnimate).toBeAttached();await expect(coreAnimate).toBeHidden();await expect(coreAnimate).toHaveAttribute('data-animate-mode','deformation');
  await expect(animate).toBeVisible();await expect(animate).toBeEnabled();await expect(animate).toHaveAttribute('data-animate-mode','deformation');await expect(settings).toBeVisible();
  const toolsBox=await viewTools.boundingBox(),chromeBox=await page.locator('.engineering-canvas-chrome').boundingBox(),animateBox=await animate.boundingBox(),settingsBox=await settings.boundingBox();expect(toolsBox).not.toBeNull();expect(chromeBox).not.toBeNull();expect(animateBox).not.toBeNull();expect(settingsBox).not.toBeNull();expect(animateBox!.x).toBeGreaterThanOrEqual(toolsBox!.x);expect(settingsBox!.x+settingsBox!.width).toBeLessThanOrEqual(toolsBox!.x+toolsBox!.width+1);expect(chromeBox!.x+chromeBox!.width-(settingsBox!.x+settingsBox!.width)).toBeLessThanOrEqual(9);expect(Math.abs(settingsBox!.y-chromeBox!.y-2)).toBeLessThan(2);
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
  if((viewport?.width||1200)>900){
    await expect(page.getByTestId('engineering-right-rail').getByText(/Detalhamento após análise/)).toBeVisible();
    const quick=page.getByLabel('Campo visual rápido');
    await quick.selectOption('MyBar');await expect(canvas).toHaveAttribute('data-force-mode','MyBar');await expect(canvas).toHaveAttribute('data-bar-diagram-geometry','deformed');await expect(vector.locator('[data-scientific-bar-diagrams="true"]')).toHaveCount(1);await expect(page.getByTestId('spatial3d-bar-diagram-status')).toContainText('My');await expect(canvas).toHaveAttribute('data-diagram-label-count','3');await expect(canvas).toHaveAttribute('data-diagram-zero-labels','true');await expect(vector.locator('[data-scientific-bar-value-labels="true"]')).toHaveCount(1);await expect(vector.locator('[data-scientific-bar-value-labels="true"] text').first()).toBeAttached();await expect(page.getByTestId('engineering-diagram-label-controls')).toBeVisible();const permanentValues=page.getByTestId('engineering-diagram-label-count');await permanentValues.selectOption('5');await expect(canvas).toHaveAttribute('data-diagram-label-count','5');const zeroLabels=page.getByTestId('engineering-diagram-zero-labels');await zeroLabels.uncheck();await expect(canvas).toHaveAttribute('data-diagram-zero-labels','false');await zeroLabels.check();await expect(canvas).toHaveAttribute('data-diagram-zero-labels','true');
    const diagramLine=vector.locator('[data-scientific-bar-diagrams="true"] line').first(),vectorBox=await vector.boundingBox();expect(vectorBox).not.toBeNull();const coords=await diagramLine.evaluate((el:any)=>({x1:Number(el.getAttribute('x1')),y1:Number(el.getAttribute('y1')),x2:Number(el.getAttribute('x2')),y2:Number(el.getAttribute('y2'))}));await page.mouse.move(vectorBox!.x+(coords.x1+coords.x2)/2,vectorBox!.y+(coords.y1+coords.y2)/2);await expect(page.getByTestId('spatial3d-diagram-probe')).toBeVisible();await expect(page.getByTestId('spatial3d-diagram-probe')).toContainText('x/L');await expect(canvas).toHaveAttribute('data-bar-probe-active','true');
    await page.evaluate(()=>window.dispatchEvent(new CustomEvent('astrastruct:frame-diagram-envelope-3d',{detail:{field:'MyBar',label:'Envelope E2E',envelope:{contract:'frame-diagram-envelope-3d/v1',scenarioIds:['C1','C2'],elements:[{elementId:'C1',type:'frame3d',axes:{ey:[0,1,0],ez:[1,0,0]},stations:[{xi:0,x:0,point:[0,0,0],fields:{MyBar:{min:-8,max:14,minCombinationId:'C1',maxCombinationId:'C2'}}},{xi:.5,x:1.5,point:[0,0,1.5],fields:{MyBar:{min:-5,max:9,minCombinationId:'C1',maxCombinationId:'C2'}}},{xi:1,x:3,point:[0,0,3],fields:{MyBar:{min:0,max:0,minCombinationId:'C1',maxCombinationId:'C2'}}}]}]}}})));
    await expect(canvas).toHaveAttribute('data-frame-envelope-field','MyBar');await expect(canvas).toHaveAttribute('data-frame-envelope-count','2');await expect(vector.locator('[data-scientific-bar-envelope="true"]')).toHaveCount(1);await expect(vector.locator('[data-scientific-envelope-value-labels="true"]')).toHaveCount(1);await expect(vector.locator('[data-scientific-envelope-value-labels="true"] text').first()).toBeAttached();await expect(page.getByTestId('spatial3d-frame-envelope-status')).toContainText('2 combinações');
    const envelopeMin=vector.locator('[data-scientific-bar-envelope="true"] polyline').first(),envPoint=await envelopeMin.evaluate((el:any)=>{const p=el.getPointAtLength(el.getTotalLength()/2),m=el.getScreenCTM();if(!m)return{x:NaN,y:NaN};const q=new DOMPoint(p.x,p.y).matrixTransform(m);return{x:q.x,y:q.y}});expect(Number.isFinite(envPoint.x)&&Number.isFinite(envPoint.y)).toBe(true);await page.mouse.move(envPoint.x,envPoint.y);const envProbe=page.getByTestId('spatial3d-envelope-probe');await expect(envProbe).toBeVisible();await expect(envProbe).toContainText('Mín.');await expect(envProbe).toContainText('Máx.');await expect(envProbe).toContainText('Ativa');await expect(envProbe).toContainText('C1');await expect(envProbe).toContainText('C2');await expect(envProbe).toContainText('x/L');await expect(canvas).toHaveAttribute('data-frame-envelope-probe-active','true');await expect(canvas).toHaveAttribute('data-frame-envelope-probe-element','C1');await expect(page.getByTestId('spatial3d-diagram-probe')).toHaveCount(0);
    await quick.selectOption('UyBar');await expect(canvas).toHaveAttribute('data-result-map-unit','mm');
    await quick.selectOption('epsX');await expect(canvas).toHaveAttribute('data-result-map-unit','µε');await expect(canvas).toHaveAttribute('data-result-map-kind','diverging');
    await quick.selectOption('none');
  }
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

test('v0.54 displacement map and result legend follow every animation frame',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-chromium','interactive scientific contour gate');
  await page.addInitScript(()=>localStorage.setItem('astrastruct.project',JSON.stringify({id:'v054-animated-contour',name:'Mapa animado',version:13,schemaVersion:2,units:'kN-m-MPa',nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:4,y:0,z:0},{id:'N3',x:4,y:3,z:0},{id:'N4',x:0,y:3,z:0}],elements:[{id:'S1',type:'shell4',nodeIds:['N1','N2','N3','N4'],n1:'N1',n2:'N2',n3:'N3',n4:'N4',materialId:'C',thickness:.2,shearCorrection:5/6,drillingFactor:1e-6}],materials:[{id:'C',name:'Concreto',type:'concrete',E:30e6,nu:.2,density:25}],sections:[],supports:['N1','N4'].map(nodeId=>({nodeId,ux:true,uy:true,uz:true,rx:true,ry:true,rz:true})),loads:[],elementLoads:[{id:'P1',caseId:'LC1',elementId:'S1',kind:'surface',pressure:-10}],settlements:[],nodeSprings:[],nodalMasses:[],loadCases:[{id:'LC1',name:'Pressão',type:'user'}],loadCombinations:[],connections:[],diaphragms:[],settings:{analysisType:'linear',analysisScenarioId:'LC1',activeLoadCaseId:'LC1'}})));
  await page.goto(preview);await page.waitForFunction(()=>document.documentElement.dataset.astraReady==='true');await page.getByTestId('engineering-ribbon-analyze').click();
  const canvas=page.getByTestId('spatial-canvas-3d'),legend=page.getByTestId('engineering-result-legend'),animate=page.getByTestId('engineering-view-animation');await page.getByLabel('Campo visual rápido').selectOption('Umag');await expect(canvas).toHaveAttribute('data-force-mode','Umag');await expect(canvas).toHaveAttribute('data-result-map-phase','1.000');await expect(canvas).toHaveAttribute('data-result-map-intensity','1.000');await expect(legend).toHaveAttribute('data-result-live','false');
  const finalMax=Number(await canvas.getAttribute('data-result-map-max')),finalGradient=await legend.locator('.eng-gradient').evaluate(element=>getComputedStyle(element).backgroundImage);expect(finalMax).toBeGreaterThan(0);await animate.click();await expect(canvas).toHaveAttribute('data-result-map-live','true');await expect(page.getByTestId('engineering-result-phase')).toContainText('Animação');
  await expect.poll(async()=>page.evaluate(({finalMax,finalGradient})=>{const canvas=document.querySelector<HTMLElement>('[data-testid="spatial-canvas-3d"]'),legend=document.querySelector<HTMLElement>('[data-testid="engineering-result-legend"]'),phase=Number(canvas?.dataset.resultMapPhase),intensity=Number(canvas?.dataset.resultMapIntensity),maximum=Number(canvas?.dataset.resultMapMax),legendIntensity=Number(legend?.dataset.resultIntensity),top=Number(legend?.querySelector('.eng-legend-ticks span')?.textContent),gradient=legend?.querySelector<HTMLElement>('.eng-gradient');return{canvasLive:canvas?.dataset.resultMapLive==='true',phaseMoving:phase<.9,intensityMoving:intensity<.9,rangeMoving:maximum<finalMax*.9,legendLive:legend?.dataset.resultLive==='true',legendMoving:legendIntensity<.95,synchronized:Math.abs(legendIntensity-intensity)<.2,ticksMoving:top<finalMax*1000*.95,ticksSynchronized:Math.abs(top-maximum*1000)<Math.max(.005,finalMax*200),gradientMoving:getComputedStyle(gradient!).backgroundImage!==finalGradient}},{finalMax,finalGradient})).toEqual({canvasLive:true,phaseMoving:true,intensityMoving:true,rangeMoving:true,legendLive:true,legendMoving:true,synchronized:true,ticksMoving:true,ticksSynchronized:true,gradientMoving:true});
  await animate.click();await expect(canvas).toHaveAttribute('data-result-map-live','false');await expect(canvas).toHaveAttribute('data-result-map-phase','1.000');await expect(canvas).toHaveAttribute('data-result-map-intensity','1.000');await expect.poll(async()=>Number(await canvas.getAttribute('data-result-map-max'))).toBeCloseTo(finalMax,10);await expect(page.getByTestId('engineering-result-phase')).toContainText('Estado final');
});
