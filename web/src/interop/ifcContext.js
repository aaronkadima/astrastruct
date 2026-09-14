const copy=v=>v==null?v:typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
const finite=(v,name)=>{const n=Number(v);if(!Number.isFinite(n))throw new Error(`IFC context: ${name} deve ser finito.`);return n;};

export const IFC_CONTEXT_CONTRACT='ifc-project-context/v1';

function siUnit(key,unitType,name,prefix=null){return{key,ifcClass:'IfcSIUnit',unitType,name,prefix};}
function derivedUnit(key,unitType,elements){return{key,ifcClass:'IfcDerivedUnit',unitType,userDefinedType:null,elements:elements.map(([unitRef,exponent])=>({ifcClass:'IfcDerivedUnitElement',unitRef,exponent}))};}

export function unitsForAstraStruct(unitSystem='kN-m-MPa'){
  const source=String(unitSystem||'').trim();
  if(source!=='kN-m-MPa')throw new Error(`IFC context: sistema de unidades ainda não suportado: ${source||'(vazio)'}.`);
  return{
    key:'context:units',ifcClass:'IfcUnitAssignment',sourceUnitSystem:source,
    units:[
      siUnit('unit:length','LENGTHUNIT','METRE'),
      siUnit('unit:area','AREAUNIT','SQUARE_METRE'),
      siUnit('unit:volume','VOLUMEUNIT','CUBIC_METRE'),
      siUnit('unit:angle','PLANEANGLEUNIT','RADIAN'),
      siUnit('unit:mass','MASSUNIT','GRAM','KILO'),
      siUnit('unit:time','TIMEUNIT','SECOND'),
      siUnit('unit:force','FORCEUNIT','NEWTON','KILO'),
      siUnit('unit:pressure','PRESSUREUNIT','PASCAL','MEGA'),
      derivedUnit('unit:linear-stiffness','LINEARSTIFFNESSUNIT',[["unit:force",1],["unit:length",-1]]),
      derivedUnit('unit:rotational-stiffness','ROTATIONALSTIFFNESSUNIT',[["unit:force",1],["unit:length",1],["unit:angle",-1]])
    ]
  };
}

function vector(values,name,size){
  if(!Array.isArray(values)||values.length!==size)throw new Error(`IFC context: ${name} deve possuir ${size} componentes.`);
  return values.map((v,i)=>finite(v,`${name}[${i}]`));
}

export function createIfcProjectContext({unitSystem='kN-m-MPa',precision=1e-6,origin=[0,0,0],axis=[0,0,1],refDirection=[1,0,0],trueNorth=[0,1]}={}){
  const p=finite(precision,'precision');if(!(p>0))throw new Error('IFC context: precision deve ser positiva.');
  const model3d={
    key:'context:model3d',ifcClass:'IfcGeometricRepresentationContext',contextIdentifier:null,contextType:'Model',coordinateSpaceDimension:3,precision:p,
    worldCoordinateSystem:{ifcClass:'IfcAxis2Placement3D',location:vector(origin,'origin',3),axis:vector(axis,'axis',3),refDirection:vector(refDirection,'refDirection',3)},
    trueNorth:trueNorth==null?null:{ifcClass:'IfcDirection',directionRatios:vector(trueNorth,'trueNorth',2)}
  };
  const context={
    contract:IFC_CONTEXT_CONTRACT,units:unitsForAstraStruct(unitSystem),representationContexts:[model3d],
    subContexts:[
      {key:'context:body',ifcClass:'IfcGeometricRepresentationSubContext',contextIdentifier:'Body',contextType:'Model',parentContextRef:model3d.key,targetView:'MODEL_VIEW'},
      {key:'context:axis',ifcClass:'IfcGeometricRepresentationSubContext',contextIdentifier:'Axis',contextType:'Model',parentContextRef:model3d.key,targetView:'MODEL_VIEW'}
    ]
  };
  validateIfcProjectContext(context);return context;
}

export function validateIfcProjectContext(context){
  if(context?.contract!==IFC_CONTEXT_CONTRACT)throw new Error('IFC context: contrato inválido.');
  if(context?.units?.ifcClass!=='IfcUnitAssignment')throw new Error('IFC context: IfcUnitAssignment ausente.');
  const unitTypes=new Set(),unitKeys=new Set();
  for(const unit of context.units.units||[]){
    if(!unit?.key||!unit.unitType)throw new Error('IFC context: unidade sem key/UnitType.');
    if(unitKeys.has(unit.key))throw new Error(`IFC context: chave de unidade duplicada ${unit.key}.`);unitKeys.add(unit.key);
    if(unitTypes.has(unit.unitType))throw new Error(`IFC context: UnitType duplicado ${unit.unitType}.`);unitTypes.add(unit.unitType);
    if(unit.ifcClass==='IfcSIUnit'){
      if(!unit.name)throw new Error(`IFC context: IfcSIUnit ${unit.key} sem Name.`);
    }else if(unit.ifcClass==='IfcDerivedUnit'){
      if(!Array.isArray(unit.elements)||!unit.elements.length)throw new Error(`IFC context: IfcDerivedUnit ${unit.key} sem elementos.`);
      for(const element of unit.elements){
        if(element?.ifcClass!=='IfcDerivedUnitElement'||!element.unitRef||!Number.isInteger(Number(element.exponent)))throw new Error(`IFC context: elemento derivado inválido em ${unit.key}.`);
      }
    }else throw new Error(`IFC context: classe de unidade não suportada ${unit.ifcClass}.`);
  }
  for(const unit of context.units.units||[])if(unit.ifcClass==='IfcDerivedUnit')for(const element of unit.elements)if(!unitKeys.has(element.unitRef))throw new Error(`IFC context: unidade derivada ${unit.key} referencia ${element.unitRef} inexistente.`);
  for(const required of ['LENGTHUNIT','AREAUNIT','VOLUMEUNIT','PLANEANGLEUNIT','LINEARSTIFFNESSUNIT','ROTATIONALSTIFFNESSUNIT'])if(!unitTypes.has(required))throw new Error(`IFC context: unidade obrigatória ausente: ${required}.`);
  const contexts=context.representationContexts||[];
  if(contexts.length!==1)throw new Error('IFC context: deve existir exatamente um contexto geométrico 3D principal nesta etapa.');
  const main=contexts[0];
  if(main.ifcClass!=='IfcGeometricRepresentationContext'||main.contextType!=='Model'||main.coordinateSpaceDimension!==3)throw new Error('IFC context: contexto 3D principal inválido.');
  if(!(Number(main.precision)>0&&Number.isFinite(Number(main.precision))))throw new Error('IFC context: precision inválida.');
  const wcs=main.worldCoordinateSystem;if(wcs?.ifcClass!=='IfcAxis2Placement3D')throw new Error('IFC context: WorldCoordinateSystem inválido.');
  vector(wcs.location,'WorldCoordinateSystem.location',3);vector(wcs.axis,'WorldCoordinateSystem.axis',3);vector(wcs.refDirection,'WorldCoordinateSystem.refDirection',3);
  if(main.trueNorth)vector(main.trueNorth.directionRatios,'TrueNorth',2);
  for(const sub of context.subContexts||[])if(sub.ifcClass!=='IfcGeometricRepresentationSubContext'||sub.parentContextRef!==main.key)throw new Error(`IFC context: subcontexto inválido ${sub.key}.`);
  return true;
}

export function attachIfcProjectContext(model,context=createIfcProjectContext({unitSystem:model?.project?.units||'kN-m-MPa'})){
  validateIfcProjectContext(context);const out=copy(model);out.context=copy(context);
  out.project.unitsInContextRef=context.units.key;out.project.representationContextRefs=context.representationContexts.map(x=>x.key);
  return out;
}
