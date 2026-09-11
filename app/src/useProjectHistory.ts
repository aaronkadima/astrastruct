import { useCallback, useEffect, useRef, useState } from 'react';
// @ts-ignore
import { normalizeProject } from '../../web/src/core/model.js';

const STORAGE_KEY='astrastruct.project';
const clone=(v:any)=>JSON.parse(JSON.stringify(v));

export function useProjectHistory(initial:any){
  const initialProject=normalizeProject(initial);
  const [project,setProjectState]=useState(initialProject);
  const projectRef=useRef(initialProject);
  const undoRef=useRef<any[]>([]);
  const redoRef=useRef<any[]>([]);
  const [,forceRender]=useState(0);

  const persist=(p:any)=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(p))}catch{}}
  const replace=(p:any)=>{projectRef.current=p;setProjectState(p);persist(p);forceRender(x=>x+1)};

  useEffect(()=>{
    // Keep the persisted model synchronized with the React source of truth from the
    // first render, not only after the user's first edit.
    persist(projectRef.current);
  },[]);

  const commit=useCallback((next:any,{record=true}:{record?:boolean}={})=>{
    const current=projectRef.current;
    const candidate=typeof next==='function'?next(clone(current)):next;
    const normalized=normalizeProject(candidate);
    if(record){
      undoRef.current.push(clone(current));
      if(undoRef.current.length>80)undoRef.current.shift();
      redoRef.current=[];
    }
    replace(normalized);
  },[]);

  const undo=useCallback(()=>{
    const prev=undoRef.current.pop();
    if(!prev)return;
    redoRef.current.push(clone(projectRef.current));
    replace(normalizeProject(prev));
  },[]);

  const redo=useCallback(()=>{
    const next=redoRef.current.pop();
    if(!next)return;
    undoRef.current.push(clone(projectRef.current));
    replace(normalizeProject(next));
  },[]);

  const clearHistory=useCallback(()=>{undoRef.current=[];redoRef.current=[];forceRender(x=>x+1)},[]);
  return {project,commit,undo,redo,clearHistory,canUndo:undoRef.current.length>0,canRedo:redoRef.current.length>0};
}
