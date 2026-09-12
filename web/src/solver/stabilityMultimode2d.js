const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const zeros=n=>Array.from({length:n},()=>Array(n).fill(0));
const maxAbsMatrix=A=>Math.max(0,...A.flat().map(v=>Math.abs(v)));
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const norm=v=>Math.hypot(...v);

function jacobiSymmetricEigen(A,maxSweeps=48,tolerance=1e-11){
  const n=A.length;if(!n)return[];
  const B=A.map(r=>r.map(Number)),V=zeros(n);for(let i=0;i<n;i++)V[i][i]=1;
  const scale=Math.max(1e-18,maxAbsMatrix(B));
  for(let sweep=0;sweep<maxSweeps;sweep++){
    let maxOff=0,changed=false;
    for(let p=0;p<n-1;p++)for(let q=p+1;q<n;q++){
      const apq=B[p][q],aa=Math.abs(apq);maxOff=Math.max(maxOff,aa);if(aa<=tolerance*scale)continue;
      const app=B[p][p],aqq=B[q][q],tau=(aqq-app)/(2*apq),sgn=tau>=0?1:-1,t=sgn/(Math.abs(tau)+Math.sqrt(1+tau*tau)),c=1/Math.sqrt(1+t*t),s=t*c;
      B[p][p]=app-t*apq;B[q][q]=aqq+t*apq;B[p][q]=B[q][p]=0;
      for(let k=0;k<n;k++)if(k!==p&&k!==q){const bkp=B[k][p],bkq=B[k][q];B[k][p]=B[p][k]=c*bkp-s*bkq;B[k][q]=B[q][k]=s*bkp+c*bkq}
      for(let k=0;k<n;k++){const vkp=V[k][p],vkq=V[k][q];V[k][p]=c*vkp-s*vkq;V[k][q]=s*vkp+c*vkq}
      changed=true;
    }
    if(!changed||maxOff<=tolerance*scale)break;
  }
  return Array.from({length:n},(_,j)=>{let vector=V.map(r=>r[j]),nrm=norm(vector);if(nrm>0)vector=vector.map(v=>v/nrm);return{value:Number(B[j][j]),vector}});
}

function dominantDescriptor(prepared,modeGeneralized){
  const translationCandidates=prepared.free.map((d,i)=>({d,i})).filter(x=>x.d%3!==2),pool=translationCandidates.length?translationCandidates:prepared.free.map((d,i)=>({d,i}));
  const pick=pool.reduce((best,x)=>Math.abs(modeGeneralized[x.i])>Math.abs(modeGeneralized[best.i])?x:best,pool[0]),globalDof=pick.d,nodeIndex=Math.floor(globalDof/3),dof=['ux','uy','rz'][globalDof%3];
  return{nodeId:prepared.nodes[nodeIndex]?.id||null,dof,globalDof,freePosition:pick.i};
}

function mac(a,b){
  const aa=dot(a,a),bb=dot(b,b);if(!(aa>0&&bb>0))return 0;const ab=dot(a,b);return Math.max(0,Math.min(1,(ab*ab)/(aa*bb)));
}

function orientToReference(vector,reference){
  if(reference?.length===vector.length&&dot(vector,reference)<0)return vector.map(v=>-v);
  if(!reference){let im=0;for(let i=1;i<vector.length;i++)if(Math.abs(vector[i])>Math.abs(vector[im]))im=i;if(vector[im]<0)return vector.map(v=>-v)}
  return vector;
}

function clusterModes(modes,tolerance){
  if(!modes.length)return[];
  const sorted=[...modes].sort((a,b)=>Math.abs(a.eigenvalue)-Math.abs(b.eigenvalue)),scale=Math.max(1e-18,...sorted.map(m=>Math.abs(m.eigenvalue))),clusters=[];
  for(const mode of sorted){
    const prev=clusters.at(-1),ref=prev?.modes?.at(-1),gap=ref?Math.abs(mode.eigenvalue-ref.eigenvalue):Infinity,local=Math.max(Math.abs(mode.eigenvalue),Math.abs(ref?.eigenvalue||0),scale*1e-6,1e-18);
    if(prev&&gap<=tolerance*local)prev.modes.push(mode);else clusters.push({id:`cluster-${clusters.length+1}`,modes:[mode]});
  }
  return clusters.map(c=>({...c,size:c.modes.length,meanEigenvalue:c.modes.reduce((s,m)=>s+m.eigenvalue,0)/c.modes.length,minAbsEigenvalue:Math.min(...c.modes.map(m=>Math.abs(m.eigenvalue)))}));
}

function clusterContinuity(current,previous){
  if(!previous?.clusters?.length)return current;
  for(const cluster of current){
    let best=null,bestScore=-1;
    for(const prev of previous.clusters){
      let sum=0;
      for(const m of cluster.modes){let p=0;for(const pm of prev.modes)p+=Math.pow(dot(m.modeGeneralized,pm.modeGeneralized),2);sum+=Math.min(1,p)}
      const score=sum/Math.max(1,cluster.modes.length);
      if(score>bestScore){bestScore=score;best=prev}
    }
    cluster.previousClusterId=best?.id||null;cluster.subspaceContinuity=Math.max(0,Math.min(1,bestScore));
    for(const m of cluster.modes){m.clusterId=cluster.id;m.clusterSize=cluster.size;m.subspaceContinuity=cluster.subspaceContinuity}
  }
  return current;
}

export function analyzeTangentSpectrum(prepared,current,Lchar,previous=null,options={}){
  const n=prepared.free.length,maxDofs=clamp(Math.round(Number(options.stabilityMaxDofs??120)||120),6,500),asymTol=Math.max(1e-12,Number(options.stabilityAsymmetryTolerance??1e-6)||1e-6),modeCount=clamp(Math.round(Number(options.stabilityModeCount??4)||4),1,Math.max(1,Math.min(12,n))),clusterTolerance=clamp(Math.abs(Number(options.stabilityClusterTolerance??0.03)||0.03),1e-6,.5),macThreshold=clamp(Number(options.stabilityMacThreshold??0.25)||0.25,0,1);
  if(!n)return{enabled:false,reason:'no-free-dofs',dofs:0,modes:[],clusters:[]};
  if(n>maxDofs)return{enabled:false,reason:'dof-limit',dofs:n,maxDofs,modes:[],clusters:[]};
  const scales=prepared.free.map(d=>d%3===2?Lchar:1),K=prepared.free.map(i=>prepared.free.map(j=>current.K[i][j])),raw=K.map((r,i)=>r.map((v,j)=>v/(scales[i]*scales[j]))),sym=raw.map((r,i)=>r.map((v,j)=>.5*(v+raw[j][i]))),skew=raw.map((r,i)=>r.map((v,j)=>v-raw[j][i])),asymmetry=maxAbsMatrix(skew)/Math.max(1,maxAbsMatrix(raw));
  const pairs=jacobiSymmetricEigen(sym).sort((a,b)=>Math.abs(a.value)-Math.abs(b.value)).slice(0,modeCount);if(!pairs.length)return{enabled:false,reason:'eigensolver-empty',dofs:n,modes:[],clusters:[]};
  const previousModes=previous?.modes||[],used=new Set(),modes=pairs.map((pair,rank)=>{
    let best=null,bestMac=-1,bestIndex=-1;
    previousModes.forEach((pm,i)=>{if(used.has(i))return;const score=mac(pair.vector,pm.modeGeneralized);if(score>bestMac){bestMac=score;best=pm;bestIndex=i}});
    if(bestMac>=macThreshold&&bestIndex>=0)used.add(bestIndex);else best=null;
    const generalized=orientToReference([...pair.vector],best?.modeGeneralized),mode=generalized.map((v,i)=>v/scales[i]),id=best?.id||`mode-${rank+1}`;
    return{id,rank:rank+1,eigenvalue:Number(pair.value),mode,modeGeneralized:generalized,dominant:dominantDescriptor(prepared,generalized),macToPrevious:best?mac(generalized,best.modeGeneralized):null,previousModeId:best?.id||null};
  });
  let clusters=clusterModes(modes,clusterTolerance);clusters=clusterContinuity(clusters,previous);
  if(!previous?.clusters?.length)for(const c of clusters){c.subspaceContinuity=null;for(const m of c.modes){m.clusterId=c.id;m.clusterSize=c.size;m.subspaceContinuity=null}}
  const primary=modes[0];
  return{enabled:true,method:'scaled-symmetric-tangent-jacobi-multimode',dofs:n,eigenvalue:primary.eigenvalue,mode:primary.mode,modeGeneralized:primary.modeGeneralized,dominant:primary.dominant,modes,clusters,modeCount,clusterTolerance,macThreshold,tangentAsymmetry:asymmetry,conservativeCompatible:asymmetry<=asymTol,asymmetryTolerance:asymTol,symmetricPart:true};
}

function fullMode(prepared,mode){const full=Array(prepared.nd).fill(0);prepared.free.forEach((d,i)=>{full[d]=mode[i]||0});return full}

export function detectMultimodeTransitions(prepared,prev,curr,previousPoint,currentPoint,previousIncrement,currentIncrement,referenceEigenvalues={},tolerance=0.05){
  if(!prev?.enabled||!curr?.enabled)return[];
  const events=[];
  for(const cm of curr.modes||[]){
    let pm=(prev.modes||[]).find(x=>x.id===cm.previousModeId||x.id===cm.id),modeMac=pm?mac(cm.modeGeneralized,pm.modeGeneralized):0;
    if(!pm){for(const candidate of prev.modes||[]){const score=mac(cm.modeGeneralized,candidate.modeGeneralized);if(score>modeMac){modeMac=score;pm=candidate}}}
    if(!pm)continue;
    const a=Number(pm.eigenvalue),b=Number(cm.eigenvalue);if(!(Number.isFinite(a)&&Number.isFinite(b))||a*b>0||Math.abs(a-b)<1e-18)continue;
    const frac=Math.abs(a)/(Math.abs(a)+Math.abs(b)||1),criticalLoadFactor=previousPoint.loadFactor+frac*(currentPoint.loadFactor-previousPoint.loadFactor),criticalDisplacement=previousPoint.monitoredDisplacement+frac*(currentPoint.monitoredDisplacement-previousPoint.monitoredDisplacement),turning=Number.isFinite(previousIncrement)&&previousIncrement*currentIncrement<0,conservative=prev.conservativeCompatible&&curr.conservativeCompatible,type=!conservative?'nonconservative-singularity-candidate':(turning?'limit-point':'bifurcation-candidate'),source=Math.abs(a)<=Math.abs(b)?pm:cm,full=fullMode(prepared,source.mode),modeByNode=prepared.nodes.map((n,i)=>({nodeId:n.id,ux:full[3*i],uy:full[3*i+1],rz:full[3*i+2]})),ref=Math.max(Math.abs(referenceEigenvalues[source.id]??referenceEigenvalues[cm.id]??a)||1,1e-18),cluster=curr.clusters?.find(c=>c.id===cm.clusterId);
    events.push({type,modeId:cm.id,modeRank:cm.rank,clusterId:cm.clusterId,clusterSize:cm.clusterSize,subspaceContinuity:cluster?.subspaceContinuity??cm.subspaceContinuity??null,mac:modeMac,betweenSteps:[previousPoint.step,currentPoint.step],step:currentPoint.step,criticalLoadFactor,criticalMonitoredDisplacement:criticalDisplacement,eigenvalueBefore:a,eigenvalueAfter:b,eigenvalueRatioBefore:a/ref,eigenvalueRatioAfter:b/ref,tolerance,loadIncrementBefore:previousIncrement,loadIncrementAfter:currentIncrement,tangentAsymmetry:Math.max(prev.tangentAsymmetry||0,curr.tangentAsymmetry||0),dominant:source.dominant,mode:source.mode,modeByNode,classificationBasis:!conservative?'tangent is materially non-symmetric; symmetric-part spectrum only':(turning?'zero crossing plus load-factor reversal':'zero crossing without load-factor reversal')});
  }
  return events.sort((a,b)=>Math.abs(a.criticalLoadFactor)-Math.abs(b.criticalLoadFactor));
}

export function applyReferenceEigenvalueRatios(state,referenceEigenvalues={}){
  if(!state?.enabled)return state;
  for(const m of state.modes||[]){const ref=Math.max(Math.abs(referenceEigenvalues[m.id]??m.eigenvalue)||1,1e-18);m.eigenvalueRatio=m.eigenvalue/ref}
  const primary=state.modes?.[0];if(primary){state.eigenvalue=primary.eigenvalue;state.eigenvalueRatio=primary.eigenvalueRatio;state.mode=primary.mode;state.modeGeneralized=primary.modeGeneralized;state.dominant=primary.dominant}
  return state;
}
