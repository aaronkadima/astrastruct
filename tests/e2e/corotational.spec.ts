import { expect, test, type Page } from '@playwright/test';

async function openCommand(page:Page,label:string){
  const width=page.viewportSize()?.width||1280;
  if(width<=1100){
    const more=page.locator('button[aria-label="Mais comandos"]:visible').first();
    await expect(more).toBeVisible();await more.click();
    const command=page.locator(`.command-sheet button[aria-label="${label}"]:visible`).first();
    await expect(command).toBeVisible();await command.click();return;
  }
  const direct=page.locator(`button[aria-label="${label}"]:visible`).first();
  if(await direct.isVisible().catch(()=>false)){await direct.click();return}
  const library=page.locator('.library-tools button').filter({hasText:label}).first();
  await expect(library).toBeVisible();await library.click();
}

async function persistedProject(page:Page){
  return page.evaluate(()=>{const raw=localStorage.getItem('astrastruct.project');return raw?JSON.parse(raw):null});
}

async function mutateProject(page:Page,mutate:(p:any,...args:any[])=>void,...args:any[]){
  await page.evaluate(({source,args})=>{
    const raw=localStorage.getItem('astrastruct.project');if(!raw)throw new Error('Projeto inicial ausente');
    const p=JSON.parse(raw),apply=(0,eval)(`(${source})`);apply(p,...args);localStorage.setItem('astrastruct.project',JSON.stringify(p));
  },{source:mutate.toString(),args});
  await page.reload();
}

async function installReferenceBeam(page:Page,kind:'uniform'|'selfWeight'){
  await mutateProject(page,(p:any,loadKind:'uniform'|'selfWeight')=>{
    const template=p.elements?.[0];if(!template)throw new Error('Elemento modelo ausente');
    p.name=loadKind==='uniform'?'E2E — UDL co-rotacional':'E2E — peso próprio co-rotacional';
    p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:3,y:0},{id:'N3',x:6,y:0}];
    p.elements=[
      {...template,id:'E1',n1:'N1',n2:'N2',A:.15,I:.003125,sectionId:'rc_30x50',releases:{rz1:false,rz2:false},rotationalSprings:{rz1:null,rz2:null}},
      {...template,id:'E2',n1:'N2',n2:'N3',A:.15,I:.003125,sectionId:'rc_30x50',releases:{rz1:false,rz2:false},rotationalSprings:{rz1:null,rz2:null}}
    ];
    p.supports=[{nodeId:'N1',ux:true,uy:true,rz:false},{nodeId:'N3',ux:false,uy:true,rz:false}];p.loads=[];p.nodeSprings=[];p.settlements=[];
    p.elementLoads=loadKind==='uniform'?[{id:'EL1',caseId:'LC1',elementId:'E1',kind:'uniform',qx:0,qy:-20},{id:'EL2',caseId:'LC1',elementId:'E2',kind:'uniform',qx:0,qy:-20}]:[{id:'SW1',caseId:'LC1',elementId:'E1',kind:'selfWeight',factor:1},{id:'SW2',caseId:'LC1',elementId:'E2',kind:'selfWeight',factor:1}];
    p.settings={...(p.settings||{}),analysisType:'linear',analysisScenarioId:'LC1',imperfection:{...(p.settings?.imperfection||{}),enabled:false}};
  },kind);
}

async function installReferencePointBeam(page:Page){
  await mutateProject(page,(p:any)=>{
    const template=p.elements?.[0];if(!template)throw new Error('Elemento modelo ausente');
    p.name='E2E — carga pontual em barra co-rotacional';p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:6,y:0}];
    p.elements=[{...template,id:'E1',n1:'N1',n2:'N2',A:.15,I:.003125,sectionId:'rc_30x50',releases:{rz1:false,rz2:false},rotationalSprings:{rz1:null,rz2:null}}];
    p.supports=[{nodeId:'N1',ux:true,uy:true,rz:false},{nodeId:'N2',ux:false,uy:true,rz:false}];p.loads=[];p.nodeSprings=[];p.settlements=[];
    p.elementLoads=[{id:'P1',caseId:'LC1',elementId:'E1',kind:'point',xi:.5,px:0,py:-100}];p.settings={...(p.settings||{}),analysisType:'linear',analysisScenarioId:'LC1',imperfection:{...(p.settings?.imperfection||{}),enabled:false}};
  });
}

async function installThermalCantilever(page:Page){
  await mutateProject(page,(p:any)=>{
    const template=p.elements?.[0];if(!template)throw new Error('Elemento modelo ausente');
    p.name='E2E — expansão térmica livre co-rotacional';p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:4,y:0}];
    p.elements=[{...template,id:'E1',n1:'N1',n2:'N2',materialId:'concrete30',A:.15,I:.003125,sectionId:'rc_30x50',releases:{rz1:false,rz2:false},rotationalSprings:{rz1:null,rz2:null}}];
    p.supports=[{nodeId:'N1',ux:true,uy:true,rz:true}];p.loads=[];p.nodeSprings=[];p.settlements=[];p.elementLoads=[{id:'T1',caseId:'LC1',elementId:'E1',kind:'thermal',dT:25,dTGradient:0}];
    p.settings={...(p.settings||{}),analysisType:'linear',analysisScenarioId:'LC1',imperfection:{...(p.settings?.imperfection||{}),enabled:false}};
  });
}

async function installFollowerCantilever(page:Page){
  await mutateProject(page,(p:any)=>{
    const template=p.elements?.[0];if(!template)throw new Error('Elemento modelo ausente');
    p.name='E2E — follower end force';p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:4,y:0}];
    p.elements=[{...template,id:'E1',n1:'N1',n2:'N2',materialId:'concrete30',A:.15,I:.003125,sectionId:'rc_30x50',releases:{rz1:false,rz2:false},rotationalSprings:{rz1:null,rz2:null}}];
    p.supports=[{nodeId:'N1',ux:true,uy:true,rz:true}];p.loads=[];p.elementLoads=[];p.nodeSprings=[];p.settlements=[];
    p.settings={...(p.settings||{}),analysisType:'linear',activeLoadCaseId:'LC1',analysisScenarioId:'LC1',imperfection:{...(p.settings?.imperfection||{}),enabled:false}};
  });
}

async function enableCorotational(page:Page){
  await openCommand(page,'Tipo de análise');const mode=page.getByTestId('analysis-corotational');await expect(mode).toBeEnabled();await mode.click();await expect(page.getByTestId('corotational-controls')).toBeVisible();await page.getByTestId('analysis-apply').click();
  await expect.poll(async()=>{const p=await persistedProject(page);return p?.settings?.analysisType}).toBe('corotational');
}

test('co-rotational mode can be configured, solved and visualized in current geometry',async({page})=>{
  await page.goto('./');await openCommand(page,'Tipo de análise');await expect(page.getByTestId('panel-analysis')).toBeVisible();const mode=page.getByTestId('analysis-corotational');await expect(mode).toBeEnabled();await mode.click();
  await page.getByTestId('nonlinear-steps').fill('6');await page.getByTestId('nonlinear-max-iterations').fill('40');await page.getByTestId('nonlinear-tolerance').fill('1e-9');await expect(page.getByTestId('nonlinear-line-search')).toBeChecked();await page.getByTestId('analysis-apply').click();
  await expect.poll(async()=>{const p=await persistedProject(page);return [p?.settings?.analysisType,Number(p?.settings?.nonlinearSteps),Number(p?.settings?.nonlinearMaxIterations),Number(p?.settings?.nonlinearTolerance)]}).toEqual(['corotational',6,40,1e-9]);
  await page.getByTestId('analyze-button').click();await expect(page.getByTestId('nonlinear-result-metric')).toContainText('6 incrementos');await expect(page.locator('.result-overlays')).toHaveAttribute('data-current-geometry','true');const deformed=page.getByTestId('deformed-overlay');await expect(deformed).toBeVisible();await expect(deformed).toHaveAttribute('data-physical-geometry','true');await expect(deformed).toHaveAttribute('data-deformation-scale','1');
  await openCommand(page,'Diagramas/envelopes');const post=page.getByTestId('panel-nonlinear-postprocess');await expect(post).toBeVisible();await expect(page.getByTestId('nonlinear-envelope-note')).toContainText('Envelope não linear desabilitado');await expect(post).toContainText('Comprimento corrente');await post.locator('button[aria-label="Fechar"]').click();
  await openCommand(page,'Relatório técnico');const report=page.getByTestId('panel-nonlinear-report');await expect(report).toBeVisible();await expect(report).toContainText('Newton–Raphson');await expect(page.getByTestId('nonlinear-report-limitations')).toContainText('experimental e não normativa');
});

test('co-rotational mode accepts reference UDL and reports its physical recovery',async({page})=>{
  await page.goto('./');await installReferenceBeam(page,'uniform');await enableCorotational(page);await page.getByTestId('analyze-button').click();await expect(page.getByTestId('nonlinear-result-metric')).toBeVisible();await openCommand(page,'Diagramas/envelopes');
  const post=page.getByTestId('panel-nonlinear-postprocess'),note=page.getByTestId('reference-load-postprocess-note');await expect(note).toContainText('qy₀=-20.000 kN/m');await expect(note).toContainText('Não é carga seguidora');await expect(post).toContainText('90.000 kN·m');
});

test('co-rotational mode accepts self-weight as a reference dead load',async({page})=>{
  await page.goto('./');await installReferenceBeam(page,'selfWeight');await enableCorotational(page);await page.getByTestId('analyze-button').click();await expect(page.getByTestId('nonlinear-result-metric')).toBeVisible();await openCommand(page,'Diagramas/envelopes');
  const post=page.getByTestId('panel-nonlinear-postprocess'),note=page.getByTestId('reference-load-postprocess-note');await expect(note).toContainText('peso próprio=3.750 kN/m');await expect(note).toContainText('qy₀=-3.750 kN/m');await expect(post).toContainText('16.875 kN·m');
});

test('co-rotational mode accepts a reference point member load and traces it in report',async({page})=>{
  await page.goto('./');await installReferencePointBeam(page);await enableCorotational(page);await page.getByTestId('analyze-button').click();await expect(page.getByTestId('nonlinear-result-metric')).toBeVisible();await openCommand(page,'Diagramas/envelopes');
  const post=page.getByTestId('panel-nonlinear-postprocess'),note=page.getByTestId('reference-load-postprocess-note');await expect(note).toContainText('P1(x/L=0.500)');await expect(note).toContainText('Py₀=-100.000 kN');await expect(post).toContainText('150.000 kN·m');await post.locator('button[aria-label="Fechar"]').click();await openCommand(page,'Relatório técnico');await expect(page.getByTestId('nonlinear-load-model')).toContainText('carga pontual em barra');await expect(page.getByTestId('panel-nonlinear-report')).toContainText('x/L=0.500');
});

test('co-rotational mode accepts thermal initial strain and traces the free expansion',async({page})=>{
  await page.goto('./');await installThermalCantilever(page);await enableCorotational(page);await expect.poll(async()=>{const p=await persistedProject(page);return p?.meta?.solverVersion}).toBe('0.13.5-exp');await page.getByTestId('analyze-button').click();await expect(page.getByTestId('nonlinear-result-metric')).toBeVisible();
  await openCommand(page,'Diagramas/envelopes');const post=page.getByTestId('panel-nonlinear-postprocess'),thermal=page.getByTestId('thermal-postprocess-note');await expect(thermal).toContainText('ΔT=25.000 °C');await expect(thermal).toContainText('εT=2.500e-4');await expect(post).toContainText('estado térmico inicial');await post.locator('button[aria-label="Fechar"]').click();
  await openCommand(page,'Relatório técnico');const report=page.getByTestId('panel-nonlinear-report');await expect(report).toContainText('0.13.5-exp');await expect(page.getByTestId('nonlinear-thermal-model')).toContainText('deformação axial e curvatura iniciais');
});

test('follower force is created in UI, follows current chord and uses consistent external tangent',async({page})=>{
  await page.goto('./');await installFollowerCantilever(page);await openCommand(page,'Tipo de análise');await page.getByTestId('analysis-corotational').click();await expect(page.getByTestId('follower-empty')).toBeVisible();await page.getByTestId('follower-add').click();await page.getByTestId('follower-px').fill('0');await page.getByTestId('follower-py').fill('-10');await expect(page.getByTestId('follower-load-note')).toContainText('Kint − λKext');await page.getByTestId('analysis-apply').click();
  await expect.poll(async()=>{const p=await persistedProject(page);const f=p?.elementLoads?.find((l:any)=>l.kind==='followerEnd');return [p?.settings?.analysisType,f?.end,f?.px,f?.py,p?.meta?.solverVersion]}).toEqual(['corotational',2,0,-10,'0.13.5-exp']);
  await openCommand(page,'Tipo de análise');await page.getByTestId('analysis-linear').click();await expect(page.getByTestId('follower-mode-warning')).toContainText('Força seguidora exige Geom. não linear');await expect(page.getByTestId('analysis-apply')).toBeDisabled();await page.getByTestId('analysis-corotational').click();await page.getByTestId('analysis-apply').click();
  await page.getByTestId('analyze-button').click();await expect(page.getByTestId('nonlinear-result-metric')).toBeVisible();await openCommand(page,'Diagramas/envelopes');const post=page.getByTestId('panel-nonlinear-postprocess'),follower=page.getByTestId('follower-postprocess-note');await expect(follower).toContainText('Px=0.000 kN');await expect(follower).toContainText('Py=-10.000 kN');await expect(follower).toContainText('Kint − λKext');await post.locator('button[aria-label="Fechar"]').click();
  await openCommand(page,'Relatório técnico');const report=page.getByTestId('panel-nonlinear-report');await expect(report).toContainText('0.13.5-exp');await expect(page.getByTestId('nonlinear-follower-model')).toContainText('Kext=dP/dq');
});

test('co-rotational mode accepts and traces a semirigid rotational connection',async({page})=>{
  await page.goto('./');await mutateProject(page,(p:any)=>{
    p.name='E2E — ligação semirrígida co-rotacional';p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:4,y:0}];const template=p.elements?.[0];p.elements=[{...template,id:'E1',n1:'N1',n2:'N2',A:.15,I:.003125,sectionId:'rc_30x50',releases:{rz1:false,rz2:false},rotationalSprings:{rz1:10000,rz2:null}}];p.supports=[{nodeId:'N1',ux:true,uy:true,rz:true}];p.loads=[{id:'P1',caseId:'LC1',nodeId:'N2',fx:0,fy:-10,mz:0}];p.elementLoads=[];p.nodeSprings=[];p.settlements=[];p.settings={...(p.settings||{}),analysisType:'linear',analysisScenarioId:'LC1',imperfection:{...(p.settings?.imperfection||{}),enabled:false}};
  });
  await openCommand(page,'Tipo de análise');const mode=page.getByTestId('analysis-corotational');await expect(mode).toBeEnabled();await mode.click();await expect(page.getByTestId('corotational-connection-note')).toContainText('1 semirrígida(s)');await expect(page.getByTestId('corotational-connection-note')).toContainText('Schur');await page.getByTestId('analysis-apply').click();await page.getByTestId('analyze-button').click();await expect(page.getByTestId('nonlinear-result-metric')).toBeVisible();
  await openCommand(page,'Diagramas/envelopes');const post=page.getByTestId('panel-nonlinear-postprocess'),connection=page.getByTestId('connection-postprocess-note');await expect(connection).toContainText('semirrígida');await expect(connection).toContainText('kθ=10000');await expect(connection).toContainText('M=kθ(θn−θe)');await post.locator('button[aria-label="Fechar"]').click();
  await openCommand(page,'Relatório técnico');await expect(page.getByTestId('nonlinear-connection-model')).toContainText('condensação estática de Schur');await expect(page.getByTestId('panel-nonlinear-report')).toContainText('semirrígida');
});

test('co-rotational mode accepts releases and preserves zero end moments under UDL',async({page})=>{
  await page.goto('./');await mutateProject(page,(p:any)=>{
    const template=p.elements?.[0];p.name='E2E — duas rótulas co-rotacionais';p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:6,y:0}];
    p.elements=[{...template,id:'E1',n1:'N1',n2:'N2',A:.15,I:.003125,sectionId:'rc_30x50',releases:{rz1:true,rz2:true},rotationalSprings:{rz1:0,rz2:0}}];
    p.supports=[{nodeId:'N1',ux:true,uy:true,rz:false},{nodeId:'N2',ux:false,uy:true,rz:false}];p.loads=[];p.nodeSprings=[];p.settlements=[];p.elementLoads=[{id:'Q1',caseId:'LC1',elementId:'E1',kind:'uniform',qx:0,qy:-20}];
    p.settings={...(p.settings||{}),analysisType:'linear',analysisScenarioId:'LC1',imperfection:{...(p.settings?.imperfection||{}),enabled:false}};
  });
  await openCommand(page,'Tipo de análise');const mode=page.getByTestId('analysis-corotational');await expect(mode).toBeEnabled();await mode.click();await expect(page.getByTestId('corotational-connection-note')).toContainText('2 rótula(s)');await page.getByTestId('analysis-apply').click();await page.getByTestId('analyze-button').click();await expect(page.getByTestId('nonlinear-result-metric')).toBeVisible();
  await openCommand(page,'Diagramas/envelopes');const post=page.getByTestId('panel-nonlinear-postprocess'),connection=page.getByTestId('connection-postprocess-note');await expect(connection).toContainText('ext.1 rótula');await expect(connection).toContainText('ext.2 rótula');await expect(connection).toContainText('kθ=0.000');await expect(post).toContainText('90.000 kN·m');await post.locator('button[aria-label="Fechar"]').click();
  await openCommand(page,'Relatório técnico');const report=page.getByTestId('panel-nonlinear-report');await expect(report).toContainText('rótula');await expect(page.getByTestId('nonlinear-connection-model')).toContainText('kθ=0');
});
