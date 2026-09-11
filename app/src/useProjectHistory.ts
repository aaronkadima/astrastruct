import { useCallback, useMemo, useRef, useState } from 'react';
// @ts-ignore
import { normalizeProject } from '../../web/src/core/model.js';

const STORAGE_KEY='astrastruct.project';
const clone=(v:any)=>JSON.parse(JSON.stringify(v));

export function useProjectHistory(initial:any){
  const [project,setProjectState]=useState(()=>normalizeProject(initial));
  const undoRef=useRef<any[]>([]);const redoRef=useRef<any[]>([]);const [,bump]=useState(0);

  const persist=(p:any)=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(p))}catch{}}
  const commit=useCallback((next:any,{record=true}:{record?:boolean}={})=>{
    setProjectState((current:any)=>{
      const candidate=typeof next==='function'?next(clone(current)):next;
      const normalized=normalizeProject(candidate);
      if(record){undoRef.current.push(clone(current));if(undoRef.current.length>80)undoRef.current.shift();redoRef.current=[]}
      persist(normalized);bump(x=>x+1);return normalized;
    });
  },[]);
  const undo=useCallback(()=>{
    setProjectState((current:any)=>{const prev=undoRef.current.pop();if(!prev)return current;redoRef.current.push(clone(current));const normalized=normalizeProject(prev);persist(normalized);bump(x=>x+1);return normalized})
  },[]);
  const redo=useCallback(()=>{
    setProjectState((current:any)=>{const next=redoRef.current.pop();if(!next)return current;undoRef.current.push(clone(current));const normalized=normalizeProject(next);persist(normalized);bump(x=>x+1);return normalized})
  },[]);
  const clearHistory=useCallback(()=>{undoRef.current=[];redoRef.current=[];bump(x=>x+1)},[]);
  const history=useMemo(()=>({canUndo:undoRef.current.length>0,canRedo:redoRef.current.length>0}),[project]);
  return {project,commit,undo,redo,clearHistory,...history};
}
