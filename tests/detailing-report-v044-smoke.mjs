import assert from 'node:assert/strict';
import {
  DETAILING_MODEL_CONTRACT,REBAR_SCHEDULE_CONTRACT,STEEL_SCHEDULE_CONTRACT,DETAILING_VERSION,
  steelMassPerMeter,layoutBarsBySpacing,createRebarMark,createRebarSchedule,createPlateMark,createAnchorMark,createWeldMark,createSteelSchedule,createDetailingPackage
} from '../web/src/detailing/index.js';
import {CALCULATION_REPORT_CONTRACT,CALCULATION_REPORT_VERSION,createCalculationReport,validateCalculationReport,renderCalculationReportMarkdown,renderCalculationReportHtml} from '../web/src/reports/index.js';
import {createCodeDesignProfile,designCheck,summarizeCodeDesign} from '../web/src/codeDesign/index.js';

const near=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} != ${b}`);
assert.equal(DETAILING_VERSION,'0.44.0-exp');assert.equal(CALCULATION_REPORT_VERSION,'0.44.0-exp');

const layout=layoutBarsBySpacing({clearLengthMm:1000,maxSpacingMm:200,edgeOffsetStartMm:50,edgeOffsetEndMm:50});
assert.equal(layout.count,6);assert.equal(layout.intervals,5);near(layout.actualSpacingMm,180);near(layout.positionsMm[0],50);near(layout.positionsMm.at(-1),950);

const b1=createRebarMark({id:'B1',diameterMm:16,quantity:6,segmentsMm:[1000,500],arcs:[{angleDeg:90,centerlineRadiusMm:64,label:'dobra 90°'}],grade:'CA-50',shape:'L',location:'Viga V1'});
near(b1.cutLengthMm,1600.5309649148735);near(b1.massPerMeterKg,1.578336149163512);near(b1.totalLengthM,9.603185789489242);near(b1.totalMassKg,15.15705527868421);
const b2=createRebarMark({id:'B2',diameterMm:10,quantity:4,segmentsMm:[800],grade:'CA-60',shape:'straight',location:'Viga V1'});
const rebar=createRebarSchedule([b1,b2]);assert.equal(rebar.contract,REBAR_SCHEDULE_CONTRACT);assert.equal(rebar.summary.markCount,2);assert.equal(rebar.summary.barCount,10);assert.equal(rebar.summary.byDiameter.length,2);

const plate=createPlateMark({id:'PL1',widthMm:300,lengthMm:200,thicknessMm:12,quantity:2,location:'Ligação C1'});near(plate.totalMassKg,11.304);
const anchor=createAnchorMark({id:'CH1',diameterMm:20,quantity:4,embedmentMm:300,projectionMm:150,additionalLengthMm:50,location:'Base P1'});near(anchor.totalLengthMm,500);near(anchor.totalMassKg,4.932300466135976);
const weld=createWeldMark({id:'S1',effectiveThroatMm:6,lengthMm:400,quantity:4,location:'Ligação C1'});near(weld.totalLengthM,1.6);near(weld.totalMassKg,.45216);
const steel=createSteelSchedule({plates:[plate],anchors:[anchor],welds:[weld]});assert.equal(steel.contract,STEEL_SCHEDULE_CONTRACT);near(steel.summary.totalMassKg,16.688460466135976);
const detailing=createDetailingPackage({projectId:'ASTRA-001',revision:'R0',reinforcement:rebar,steel,provenance:{source:'dimensionamento v0.43 + geometria explícita'}});
assert.equal(detailing.contract,DETAILING_MODEL_CONTRACT);near(detailing.summary.totalScheduledMassKg,rebar.summary.totalMassKg+steel.summary.totalMassKg);assert.ok(detailing.limitations.some(x=>x.includes('v0.45')));

const profile=createCodeDesignProfile({id:'report-profile',code:'USER-PARAMETERIZED',edition:'2026',provenance:{requiresLicensedParameters:true,automaticResistance:false},parameters:{demo:true}});
const checks=[designCheck({id:'flexure',discipline:'RC',limitState:'Flexão',demand:90,resistance:120,unit:'kN·m',profile}),designCheck({id:'licensed-pending',discipline:'Foundation',limitState:'Coeficiente ausente',demand:1,resistance:null,profile})];
const design=summarizeCodeDesign({profile,combinationId:'ULS-1',checks});
const report=createCalculationReport({
  project:{id:'ASTRA-001',name:'Edifício <Teste>',client:'Cliente Engenharia',location:'São Paulo',description:'Benchmark determinístico da memória de cálculo.'},
  document:{id:'ASTRA-001-CALC',title:'Memória de cálculo estrutural',revision:'R0',issueDate:'2026-09-13',status:'Para revisão'},
  software:{name:'AstraStruct',version:'0.44.0-dev',schemaVersion:2,resultContract:'1.0',environment:'development'},
  revisions:[{revision:'R0',date:'2026-09-13',description:'Emissão inicial',preparedBy:'Eng. A',checkedBy:'Eng. B'}],
  model:{nodes:8,elements:12,units:'kN, m, rad'},
  combinations:[{id:'ULS-1',name:'ELU benchmark',kind:'ULS',expression:'1.4G + 1.4Q'}],
  analyses:[{id:'A1',name:'Linear',analysisType:'linear',solverVersion:'0.43',converged:true,dofs:24}],
  designResults:[design],detailing,
  assumptions:['Pequenas deformações no benchmark de relatório.'],limitations:['Normas oficiais devem ser consultadas para emissão profissional.'],
  provenance:{design:'code-design/v1',detailing:'detailing-model/v1'},attachments:[{id:'ANX-1',title:'Croqui',type:'SVG',reference:'drawing-001.svg'}]
});
assert.equal(report.contract,CALCULATION_REPORT_CONTRACT);assert.equal(validateCalculationReport(report),true);assert.equal(report.design.summary.count,2);assert.equal(report.design.summary.pass,1);assert.equal(report.design.summary.pending,1);assert.equal(report.sections.length,10);
const markdown=renderCalculationReportMarkdown(report);assert.ok(markdown.includes('# Memória de cálculo estrutural'));assert.ok(markdown.includes('PENDENTE'));assert.ok(markdown.includes('B1'));assert.ok(markdown.includes('CH1'));assert.ok(markdown.includes('code-design/v1'));
const html=renderCalculationReportHtml(report);assert.ok(html.includes('<!doctype html>'));assert.ok(html.includes('Imprimir / PDF'));assert.ok(html.includes('Memória de cálculo'));assert.ok(html.includes('Edifício &lt;Teste&gt;'));assert.ok(!html.includes('Edifício <Teste>'));assert.ok(html.includes('PENDENTE'));assert.ok(html.includes('ASTRA-001-CALC'));
near(steelMassPerMeter(16),1.578336149163512);

console.log('AstraStruct v0.44 detailing/report smoke: rebar spacing/cut length/mass, steel schedules, traceable design checks and deterministic professional report coherent.');
