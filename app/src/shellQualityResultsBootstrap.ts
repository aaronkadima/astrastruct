// Mirrors shell4 geometric quality in the analysis results area.
// @ts-ignore
import {evaluateShellMeshQuality} from '../../web/src/core/shellQuality.js';

const STORAGE_KEY='astrastruct.project';
function current(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')}catch{return null}}
function fmt(v:any,d=3){return Number.isFinite(Number(v))?Number(v).toFixed(d):'—'}
function patch(){document.querySelectorAll<HTMLElement>('[data-testid="spatial3d-results"]').forEach(results=>{if(results.querySelector('[data-testid="shell4-quality-results"]'))return;const p=current();if(!p||(p.elements||[]).every((e:any)=>e.type!=='shell4'))return;const q=evaluateShellMeshQuality(p),card=document.createElement('div');card.className='panel-note';card.setAttribute('data-testid','shell4-quality-results');card.innerHTML=`<b>Qualidade da malha shell4:</b> ${q.counts.good} boa(s) · ${q.counts.warning} em atenção · ${q.counts.invalid} inválida(s) · Jesc mín. ${fmt(q.worst.minScaledJacobian)} · Jmin/Jmax mín. ${fmt(q.worst.jacobianRatio)} · aspect máx. ${fmt(q.worst.aspectRatio,2)}${q.counts.invalid?'<br><b>Diagnóstico:</b> existem elementos geometricamente inválidos; revise a malha antes de interpretar os resultados.':''}`;const metrics=results.querySelector('.metrics');metrics?.insertAdjacentElement('afterend',card)})}
const observer=new MutationObserver(()=>patch());observer.observe(document.documentElement,{childList:true,subtree:true});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',patch,{once:true});else patch();
