export const EPS=1e-12;
export const zeros=(r,c=r)=>Array.from({length:r},()=>Array(c).fill(0));
export const transpose=A=>A[0].map((_,j)=>A.map(row=>row[j]));
export const mm=(A,B)=>A.map(row=>B[0].map((_,j)=>row.reduce((s,v,k)=>s+v*B[k][j],0)));
export const matVec=(A,x)=>A.map(row=>row.reduce((s,v,i)=>s+v*x[i],0));
export const subtract=(a,b)=>a.map((v,i)=>v-b[i]);
export const add=(a,b)=>a.map((v,i)=>v+b[i]);
export const scale=(a,s)=>a.map(v=>v*s);
export const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
export const norm=a=>Math.hypot(...a);
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];

export function byId(rows,id,label='item',elementId='') {const row=(rows||[]).find(item=>String(item.id)===String(id));if(!row)throw new Error(`AdvancedElement ${elementId}: ${label} ${id} não encontrado.`);return row}
export const nodeFor=(project,id,elementId='')=>byId(project?.nodes,id,'nó',elementId);
export const materialFor=(project,element)=>byId(project?.materials,element.materialId,'material',element.id);
export const sectionFor=(project,element)=>(project?.sections||[]).find(section=>String(section.id)===String(element.sectionId))||{};
export function property(element,section,key,fallback=null){const value=Number(element?.[key]??section?.[key]??fallback);return Number.isFinite(value)?value:null}
export function positive(name,value,elementId=''){const n=Number(value);if(!(n>0))throw new Error(`AdvancedElement ${elementId}: ${name} deve ser positivo.`);return n}
export function finite(name,value,elementId=''){const n=Number(value);if(!Number.isFinite(n))throw new Error(`AdvancedElement ${elementId}: ${name} deve ser finito.`);return n}

export function geometry2D(project,element){const a=nodeFor(project,element.n1,element.id),b=nodeFor(project,element.n2,element.id),dx=Number(b.x)-Number(a.x),dy=Number(b.y)-Number(a.y),L=Math.hypot(dx,dy);if(!(L>EPS))throw new Error(`AdvancedElement ${element.id}: comprimento nulo.`);return{a,b,dx,dy,L,c:dx/L,s:dy/L}}
export function geometry3D(project,element){const a=nodeFor(project,element.n1,element.id),b=nodeFor(project,element.n2,element.id),pa=[Number(a.x),Number(a.y),Number(a.z||0)],pb=[Number(b.x),Number(b.y),Number(b.z||0)],d=pb.map((v,i)=>v-pa[i]),L=norm(d);if(!(L>EPS))throw new Error(`AdvancedElement ${element.id}: comprimento nulo.`);return{a,b,pa,pb,d,L,n:d.map(v=>v/L)}}
export function elementDofs(element,labels){return[element.n1,element.n2].flatMap(nodeId=>labels.map(label=>({owner:String(nodeId),nodeId:String(nodeId),label})))}

export function assertNoElementLoads(project,element,kind){const loads=(project?.elementLoads||[]).filter(load=>String(load.elementId)===String(element.id));if(loads.length)throw new Error(`${kind} ${element.id}: cargas de barra ainda não são suportadas nesta versão; use cargas nodais equivalentes.`)}
export function symmetricError(A){let max=0;for(let i=0;i<A.length;i++)for(let j=i+1;j<A.length;j++)max=Math.max(max,Math.abs(A[i][j]-A[j][i]));return max}
