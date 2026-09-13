import {ElementStateTransaction} from '../core/elementComponent.js';
import {concreteDamageState,initialConcreteDamageState} from './concreteDamage1d.js';
import {rebarState,initialRebarState} from './rebar1d.js';

export const RC_SECTION_RESPONSE_CONTRACT='rc-section-response/v1';

const finite=(name,value)=>{const n=Number(value);if(!Number.isFinite(n))throw new Error(`RCSection: ${name} deve ser finito.`);return n};
const zeros=()=>Array.from({length:3},()=>Array(3).fill(0));
const clone=v=>typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));

function generalized(value={}){if(Array.isArray(value)){if(value.length!==3)throw new Error('RCSection: generalizedStrain deve ter 3 valores.');return value.map((v,i)=>finite(`generalizedStrain[${i}]`,v))}return[finite('epsilon0',value.epsilon0??0),finite('kappaY',value.kappaY??0),finite('kappaZ',value.kappaZ??0)]}
function materialMap(section){return new Map((section?.materials||[]).map(material=>[String(material.id),material]))}
function fiberHistory(committed,id,materialType){const row=committed?.fibers?.[String(id)];if(row)return row;return materialType==='concrete'||materialType==='grout'?initialConcreteDamageState():initialRebarState()}
function characteristicLengthFor(fiber,options){if(typeof options.characteristicLength==='function')return Number(options.characteristicLength(fiber));const explicit=Number(fiber.characteristicLength??options.characteristicLength);return Number.isFinite(explicit)&&explicit>0?explicit:Math.sqrt(Number(fiber.area))}
function concreteOptions(material,fiber,options){const typeOptions=options.concrete||{},byId=options.materials?.[material.id]||{};return{...typeOptions,...byId,characteristicLength:characteristicLengthFor(fiber,{...options,...typeOptions,...byId})}}
function rebarOptions(material,options){return{hardeningRatio:Number(options.rebar?.hardeningRatio??options.materials?.[material.id]?.hardeningRatio??.01),kinematicFraction:Number(options.rebar?.kinematicFraction??options.materials?.[material.id]?.kinematicFraction??1)}}

export function rcFiberSectionResponse3D({section,generalizedStrain={},committedHistory=null,options={}}={}){
  if(section?.contract!=='section-definition/v1'||section?.kind!=='rc')throw new Error('RCSection: informe uma section-definition/v1 do tipo rc.');const fibers=Array.from(section.fibers||[]),materials=materialMap(section);if(!fibers.length)throw new Error('RCSection: seção sem fibras.');const e=generalized(generalizedStrain),K=zeros(),trialFibers={};let N=0,My=0,Mz=0,crackedFibers=0,closedCrackFibers=0,crushedFibers=0,yieldedBars=0;
  const states=fibers.map((fiber,index)=>{
    const id=String(fiber.id??index),y=finite(`fiber ${id}.y`,fiber.y),z=finite(`fiber ${id}.z`,fiber.z),area=finite(`fiber ${id}.area`,fiber.area);if(!(area>0))throw new Error(`RCSection: área inválida na fibra ${id}.`);const material=materials.get(String(fiber.materialId));if(!material)throw new Error(`RCSection: material ${fiber.materialId} ausente.`);const type=String(material.type||'').toLowerCase(),B=[1,-z,y],strain=e[0]-e[1]*z+e[2]*y,history=fiberHistory(committedHistory,id,type);let state;
    if(type==='concrete'||type==='grout')state=concreteDamageState({strain,material,committed:history,...concreteOptions(material,fiber,options)});
    else if(type==='rebar'||type==='steel')state=rebarState({strain,material,committed:history,...rebarOptions(material,options)});
    else throw new Error(`RCSection: tipo de material ${material.type||'(ausente)'} não suportado na seção RC não linear.`);
    trialFibers[id]=clone(state.history);const stress=finite(`fiber ${id}.stress`,state.stress),Et=finite(`fiber ${id}.tangent`,state.tangent),force=stress*area,IyLocal=Math.max(0,finite(`fiber ${id}.IyLocal`,fiber.IyLocal??0)),IzLocal=Math.max(0,finite(`fiber ${id}.IzLocal`,fiber.IzLocal??0)),IyzLocal=finite(`fiber ${id}.IyzLocal`,fiber.IyzLocal??0),localMy=Et*(e[1]*IyLocal-e[2]*IyzLocal),localMz=Et*(-e[1]*IyzLocal+e[2]*IzLocal);
    N+=force;My+=B[1]*force+localMy;Mz+=B[2]*force+localMz;K[0][0]+=Et*area;K[0][1]+=Et*(-area*z);K[1][0]+=Et*(-area*z);K[0][2]+=Et*(area*y);K[2][0]+=Et*(area*y);K[1][1]+=Et*(area*z*z+IyLocal);K[2][2]+=Et*(area*y*y+IzLocal);const yz=-Et*(area*y*z+IyzLocal);K[1][2]+=yz;K[2][1]+=yz;
    if(state.cracked)crackedFibers++;if(state.crackClosed)closedCrackFibers++;if(state.crushed)crushedFibers++;if(state.yielded)yieldedBars++;
    return{...fiber,strain,stress,tangent:Et,force,materialType:type,branch:state.branch,cracked:!!state.cracked,crackClosed:!!state.crackClosed,crushed:!!state.crushed,yielded:!!state.yielded,localMomentCorrection:{My:localMy,Mz:localMz},history:clone(state.history)};
  });
  return{contract:RC_SECTION_RESPONSE_CONTRACT,sectionId:section.id,generalizedStrain:{epsilon0:e[0],kappaY:e[1],kappaZ:e[2]},resultants:{N,My,Mz},resultantVector:[N,My,Mz],tangent:K,fibers:states,trialHistory:{contract:'rc-section-history/v1',fibers:trialFibers},fiberCount:fibers.length,crackedFibers,closedCrackFibers,crushedFibers,yieldedBars};
}

/** Transactional section evaluator: every trial starts from the last committed history. */
export function createRCSectionTransaction({section,options={},initialHistory={contract:'rc-section-history/v1',fibers:{}}}={}){
  const tx=new ElementStateTransaction(initialHistory);let last=null;
  return Object.freeze({contract:'rc-section-transaction/v1',sectionId:section?.id,response:(generalizedStrain)=>{last=rcFiberSectionResponse3D({section,generalizedStrain,committedHistory:tx.committed(),options});tx.setTrial(last.trialHistory);return clone(last)},commit:()=>tx.commit(),rollback:()=>tx.rollback(),reset:(next=initialHistory)=>tx.reset(next),committedHistory:()=>tx.committed(),trialHistory:()=>tx.trial(),snapshot:()=>tx.snapshot(),lastResponse:()=>last?clone(last):null});
}
