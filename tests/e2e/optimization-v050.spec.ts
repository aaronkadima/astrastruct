import{test,expect,type Page}from'@playwright/test';
async function openOptimization(page:Page){await page.goto('./');const width=page.viewportSize()?.width||1280;if(width<=1100){await page.locator('button[aria-label="Mais comandos"]:visible').click();const cmd=page.locator('.command-sheet button[aria-label="Otimização"]:visible');await expect(cmd).toBeVisible();await cmd.click();}else{const cmd=page.locator('button[aria-label="Otimização"]:visible').first();await expect(cmd).toBeVisible();await cmd.click();}await expect(page.getByTestId('optimization-workbench')).toBeVisible();}

test('v0.50 optimization workbench runs, persists compact study and applies best project',async({page})=>{
  await page.goto('./');
  await page.evaluate(()=>{const raw=localStorage.getItem('astrastruct.project');if(!raw)throw new Error('project missing');const p=JSON.parse(raw);p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:2,y:0}];p.elements=[{id:'E1',type:'truss2d',n1:'N1',n2:'N2',materialId:'steel355',sectionId:'truss_generic',A:.01,I:0}];p.supports=[{nodeId:'N1',ux:true,uy:true,rz:false},{nodeId:'N2',ux:false,uy:true,rz:false}];p.loads=[{id:'P1',caseId:'LC1',nodeId:'N2',fx:100,fy:0,mz:0}];p.optimizationStudy={contract:'project-optimization-study/v1',version:'0.50.0-exp',name:'E2E optimization',method:'bounded-coordinate-search',scenarioId:'LC1',direction:'minimize',variables:[{id:'A',target:{kind:'entity',collection:'elements',id:'E1',property:'A'},lower:.001,upper:.02,initial:.01}],objective:{kind:'design-sum',terms:[{variableId:'A',coefficient:1,power:1}]},constraints:[{id:'SLS-u',selector:{type:'node-displacement',nodeId:'N2',component:'ux'},relation:'<=',limit:.0002}],initialStepFraction:.25,tolerance:1e-5,maxIterations:120,storeHistory:true,lastResult:null};localStorage.setItem('astrastruct.project',JSON.stringify(p));});
  await openOptimization(page);
  await page.getByTestId('optimization-run').click();
  const result=page.getByTestId('optimization-result');await expect(result).toBeVisible();await expect(result).toContainText('sim');
  const beforeApply=await page.evaluate(()=>JSON.parse(localStorage.getItem('astrastruct.project')||'{}').elements?.find((e:any)=>e.id==='E1')?.A);expect(beforeApply).toBeCloseTo(.01,8);
  await page.getByTestId('optimization-save').click();
  await expect.poll(async()=>page.evaluate(()=>JSON.parse(localStorage.getItem('astrastruct.project')||'{}').optimizationStudy?.lastResult?.best?.values?.A||0)).toBeCloseTo(.005,3);
  const persisted=await page.evaluate(()=>JSON.parse(localStorage.getItem('astrastruct.project')||'{}').optimizationStudy);expect(persisted.contract).toBe('project-optimization-study/v1');expect(persisted.lastResult.bestProject).toBeUndefined();expect(persisted.lastResult.history).toBeUndefined();
  await page.getByTestId('optimization-apply').click();
  await expect.poll(async()=>page.evaluate(()=>JSON.parse(localStorage.getItem('astrastruct.project')||'{}').elements?.find((e:any)=>e.id==='E1')?.A||0)).toBeCloseTo(.005,3);
  await page.getByRole('button',{name:'Fechar otimização'}).click();
});
