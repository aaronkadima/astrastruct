export type IsolatedLabRegistration={
  id:string;
  title:string;
  description:string;
  meta:string;
  order?:number;
  testId?:string;
  open:()=>void;
};

export const LAB_REGISTRY_CHANGED='astrastruct:lab-registry-changed';

const registry=new Map<string,IsolatedLabRegistration>();

function normalize(reg: IsolatedLabRegistration):IsolatedLabRegistration{
  const id=String(reg?.id||'').trim();
  const title=String(reg?.title||'').trim();
  const description=String(reg?.description||'').trim();
  const meta=String(reg?.meta||'').trim();
  if(!id||!/^[a-z0-9][a-z0-9-]*$/.test(id))throw new Error(`AstraStruct LabRegistry: id inválido: ${id||'(vazio)'}`);
  if(!title)throw new Error(`AstraStruct LabRegistry: título ausente para ${id}.`);
  if(typeof reg.open!=='function')throw new Error(`AstraStruct LabRegistry: open() ausente para ${id}.`);
  return{...reg,id,title,description,meta,order:Number.isFinite(Number(reg.order))?Number(reg.order):100,testId:reg.testId?String(reg.testId):undefined};
}

function emit(){
  if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent(LAB_REGISTRY_CHANGED));
}

export function registerIsolatedLab(registration:IsolatedLabRegistration){
  const reg=normalize(registration),existing=registry.get(reg.id);
  if(existing){
    const same=existing.title===reg.title&&existing.description===reg.description&&existing.meta===reg.meta&&existing.order===reg.order&&existing.testId===reg.testId&&existing.open===reg.open;
    if(same)return existing;
  }
  registry.set(reg.id,reg);emit();return reg;
}

export function unregisterIsolatedLab(id:string){
  const removed=registry.delete(String(id||'').trim());
  if(removed)emit();
  return removed;
}

export function getIsolatedLabs(){
  return [...registry.values()].sort((a,b)=>(Number(a.order)||0)-(Number(b.order)||0)||a.title.localeCompare(b.title,'pt-BR'));
}

export function openIsolatedLab(id:string){
  const reg=registry.get(String(id||'').trim());
  if(!reg)throw new Error(`AstraStruct LabRegistry: Lab não registrado: ${id}`);
  reg.open();
}

export function hasIsolatedLab(id:string){return registry.has(String(id||'').trim())}
