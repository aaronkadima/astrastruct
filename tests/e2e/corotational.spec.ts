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

async function installReferenceBeam(page:Page,kind:'uniform'|'selfWeight'){
  await page.evaluate((loadKind)=>{
    const raw=localStorage.getItem('astrastruct.project');if(!raw)throw new Error('Projeto inicial ausente');
    const p=JSON.parse(raw),template=p.elements?.[0];if(!template)throw new Error('Elemento modelo ausente');
    p.name=loadKind==='uniform'?'E2E — UDL co-rotacional':'E2E — peso próprio co-rotacional';
    p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:3,y:0},{id:'N3',x:6,y:0}];
    p.elements=[
      {...template,id:'E1',n1:'N1',n2:'N2',A:.15,I:.003125,sectionId:'rc_30x50',releases:{rz1:false,rz2:false},rotationalSprings:{rz1:null,rz2:null}},
      {...template,id:'E2',n1:'N2',n2:'N3',A:.15,I:.003125,sectionId:'rc_30x50',releases:{rz1:false,rz2:false},rotationalSprings:{rz1:null,rz2:null}}
    ];
    p.supports=[{nodeId:'N1',ux:true,uy:true,rz:false},{nodeId:'N3',ux:false,uy:true,rz:false}];
    p.loads=[];p.nodeSprings=[];p.settlements=[];
    p.elementLoads=loadKind==='uniform'
      ?[{id:'EL1',caseId:'LC1',elementId:'E1',kind:'uniform',qx:0,qy:-20},{id:'EL2',caseId:'LC1',elementId:'E2',kind:'uniform',qx:0,qy:-20}]
      :[{id:'SW1',caseId:'LC1',elementId:'E1',kind:'selfWeight',factor:1},{id:'SW2',caseId:'LC1',elementId:'E2',kind:'selfWeight',factor:1}];
    p.settings={...(p.settings||{}),analysisType:'linear',analysisScenarioId:'LC1',imperfection:{...(p.settings?.imperfection||{}),enabled:false}};
    localStorage.setItem('astrastruct.project',JSON.stringify(p));
  },kind);
  await page.reload();
}

async function installReferencePointBeam(page:Page){
  await page.evaluate(()=>{
    const raw=localStorage.getItem('astrastruct.project');if(!raw)throw new Error('Projeto inicial ausente');
    const p=JSON.parse(raw),template=p.elements?.[0];if(!template)throw new Error('Elemento modelo ausente');
    p.name='E2E — carga pontual em barra co-rotacional';
    p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:6,y:0}];
    p.elements=[{...template,id:'E1',n1:'N1',n2:'N2',A:.15,I:.003125,sectionId:'rc_30x50',releases:{rz1:false,rz2:false},rotationalSprings:{rz1:null,rz2:null}}];
    p.supports=[{nodeId:'N1',ux:true,uy:true,rz:false},{nodeId:'N2',ux:false,uy:true,rz:false}];
    p.loads=[];p.nodeSprings=[];p.settlements=[];
    p.elementLoads=[{id:'P1',caseId:'LC1',elementId:'E1',kind:'point',xi:.5,px:0,py:-100}];
    p.settings={...(p.settings||{}),analysisType:'linear',analysisScenarioId:'LC1',imperfection:{...(p.settings?.imperfection||{}),enabled:false}};
    localStorage.setItem('astrastruct.project',JSON.stringify(p));
  });
  await page.reload();
}

async function enableCorotational(page:Page){
  await openCommand(page,'Tipo de análise');
  const mode=page.getByTestId('analysis-corotational');await expect(mode).toBeEnabled();await mode.click();
  await expect(page.getByTestId('corotational-controls')).toBeVisible();
  await page.getByTestId('analysis-apply').click();
  await expect.poll(async()=>{const p=await persistedProject(page);return p?.settings?.analysisType}).toBe('corotational');
}

test('co-rotational mode can be configured, solved and visualized in current geometry',async({page})=>{
  await page.goto('./');
  await openCommand(page,'Tipo de análise');
  await expect(page.getByTestId('panel-analysis')).toBeVisible();
  const mode=page.getByTestId('analysis-corotational');
  await expect(mode).toBeEnabled();await mode.click();
  await expect(page.getByTestId('corotational-controls')).toBeVisible();
  await page.getByTestId('nonlinear-steps').fill('6');
  await page.getByTestId('nonlinear-max-iterations').fill('40');
  await page.getByTestId('nonlinear-tolerance').fill('1e-9');
  await expect(page.getByTestId('nonlinear-line-search')).toBeChecked();
  await page.getByTestId('analysis-apply').click();
  await expect.poll(async()=>{const p=await persistedProject(page);return p?.settings?.analysisType}).toBe('corotational');
  await expect.poll(async()=>{const p=await persistedProject(page);return Number(p?.settings?.nonlinearSteps)}).toBe(6);
  await expect.poll(async()=>{const p=await persistedProject(page);return Number(p?.settings?.nonlinearMaxIterations)}).toBe(40);
  await expect.poll(async()=>{const p=await persistedProject(page);return Number(p?.settings?.nonlinearTolerance)}).toBe(1e-9);
  await page.getByTestId('analyze-button').click();
  await expect(page.getByTestId('nonlinear-result-metric')).toBeVisible();
  await expect(page.getByTestId('nonlinear-result-metric')).toContainText('6 incrementos');
  await expect(page.getByTestId('nonlinear-result-note')).toContainText('co‑rotacional');
  await expect(page.locator('.result-overlays')).toHaveAttribute('data-current-geometry','true');
  const deformed=page.getByTestId('deformed-overlay');
  await expect(deformed).toBeVisible();
  await expect(deformed).toHaveAttribute('data-physical-geometry','true');
  await expect(deformed).toHaveAttribute('data-deformation-scale','1');
  await expect(page.locator('.deformed-curve.nonlinear').first()).toBeVisible();
  const visualAmplifier=page.locator('.canvas-result-scales label[title="Escala gráfica da deformada"]');
  await expect(visualAmplifier).toBeHidden();

  await openCommand(page,'Diagramas/envelopes');
  const post=page.getByTestId('panel-nonlinear-postprocess');
  await expect(post).toBeVisible();
  await expect(page.getByTestId('nonlinear-envelope-note')).toContainText('Envelope não linear desabilitado');
  await expect(post).toContainText('Comprimento corrente');
  await expect(post).toContainText('σ superior(x)');
  await expect(post.locator('.segmented')).toHaveCount(0);
  await post.locator('button[aria-label="Fechar"]').click();

  await openCommand(page,'Relatório técnico');
  const report=page.getByTestId('panel-nonlinear-report');
  await expect(report).toBeVisible();
  await expect(report).toContainText('Newton–Raphson');
  await expect(report).toContainText('Extremos por elemento na configuração corrente');
  await expect(page.getByTestId('nonlinear-report-limitations')).toContainText('experimental e não normativa');
  await expect(page.getByTestId('nonlinear-report-limitations')).toContainText('envelopes não lineares');
});

test('co-rotational mode accepts reference UDL and reports its physical recovery',async({page})=>{
  await page.goto('./');await installReferenceBeam(page,'uniform');await enableCorotational(page);
  await page.getByTestId('analyze-button').click();await expect(page.getByTestId('nonlinear-result-metric')).toBeVisible();
  await openCommand(page,'Diagramas/envelopes');
  const post=page.getByTestId('panel-nonlinear-postprocess'),note=page.getByTestId('reference-load-postprocess-note');
  await expect(post).toBeVisible();await expect(note).toBeVisible();
  await expect(note).toContainText('carga uniforme/peso próprio');await expect(note).toContainText('Não é carga seguidora');await expect(note).toContainText('qy₀=-20.000 kN/m');
  await expect(post).toContainText('90.000 kN·m');await expect(post).toContainText('carga morta de referência');
});

test('co-rotational mode accepts self-weight as a reference dead load',async({page})=>{
  await page.goto('./');await installReferenceBeam(page,'selfWeight');await enableCorotational(page);
  await page.getByTestId('analyze-button').click();await expect(page.getByTestId('nonlinear-result-metric')).toBeVisible();
  await openCommand(page,'Diagramas/envelopes');
  const post=page.getByTestId('panel-nonlinear-postprocess'),note=page.getByTestId('reference-load-postprocess-note');
  await expect(post).toBeVisible();await expect(note).toBeVisible();
  await expect(note).toContainText('peso próprio=3.750 kN/m');await expect(note).toContainText('qy₀=-3.750 kN/m');await expect(post).toContainText('16.875 kN·m');
});

test('co-rotational mode accepts a reference point member load and traces it in report',async({page})=>{
  await page.goto('./');await installReferencePointBeam(page);await enableCorotational(page);
  await page.getByTestId('analyze-button').click();await expect(page.getByTestId('nonlinear-result-metric')).toBeVisible();
  await openCommand(page,'Diagramas/envelopes');
  const post=page.getByTestId('panel-nonlinear-postprocess'),note=page.getByTestId('reference-load-postprocess-note');
  await expect(post).toBeVisible();await expect(note).toBeVisible();
  await expect(note).toContainText('carga pontual em barra');await expect(note).toContainText('P1(x/L=0.500)');await expect(note).toContainText('Py₀=-100.000 kN');await expect(note).toContainText('Não é carga seguidora');
  await expect(post).toContainText('150.000 kN·m');
  await post.locator('button[aria-label="Fechar"]').click();
  await openCommand(page,'Relatório técnico');
  const report=page.getByTestId('panel-nonlinear-report');await expect(report).toBeVisible();
  await expect(page.getByTestId('nonlinear-load-model')).toContainText('carga pontual em barra');
  await expect(report).toContainText('x/L=0.500');await expect(report).toContainText('-100.00');
  await expect(page.getByTestId('nonlinear-report-limitations')).not.toContainText('carga pontual em barra, ações térmicas');
});

test('co-rotational mode refuses a model with a rotational release',async({page})=>{
  await page.goto('./');
  await page.evaluate(()=>{
    const raw=localStorage.getItem('astrastruct.project');if(!raw)throw new Error('Projeto inicial ausente');
    const p=JSON.parse(raw);p.elements[0].releases={...(p.elements[0].releases||{}),rz1:true};localStorage.setItem('astrastruct.project',JSON.stringify(p));
  });
  await page.reload();
  await openCommand(page,'Tipo de análise');
  await expect(page.getByTestId('analysis-corotational')).toBeDisabled();
  await expect(page.getByTestId('corotational-incompatibilities')).toContainText('Releases e ligações semirrígidas');
});
