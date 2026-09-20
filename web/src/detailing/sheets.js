export const DRAWING_SHEET_CONTRACT='engineering-drawing-sheet/v1';
export const DRAWING_SHEET_VERSION='0.52.0-exp';
export const PAPER_SIZES_MM={A0:[1189,841],A1:[841,594],A2:[594,420],A3:[420,297],A4:[297,210]};
const clone=v=>v==null?v:typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
const finite=(name,v)=>{const n=Number(v);if(!Number.isFinite(n))throw new Error(`DrawingSheet: ${name} deve ser finito.`);return n};
const text=(name,v)=>{const s=String(v??'').trim();if(!s)throw new Error(`DrawingSheet: ${name} é obrigatório.`);return s};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function createDrawingSheet({id='S1',title='Detalhamento de armaduras',paper='A1',orientation='landscape',scale='1:25',revision='R0',projectId='',entities=[],source={}}={}){
  const p=String(paper).toUpperCase();if(!PAPER_SIZES_MM[p])throw new Error(`DrawingSheet: papel ${p} não suportado.`);
  const landscape=orientation!=='portrait',[a,b]=PAPER_SIZES_MM[p],widthMm=landscape?Math.max(a,b):Math.min(a,b),heightMm=landscape?Math.min(a,b):Math.max(a,b);
  return{contract:DRAWING_SHEET_CONTRACT,version:DRAWING_SHEET_VERSION,id:text('id',id),title:text('title',title),paper:p,orientation:landscape?'landscape':'portrait',widthMm,heightMm,scale:String(scale||'1:25'),revision:String(revision||'R0'),projectId:String(projectId||''),entities:Array.from(entities||[],normalizeEntity),source:clone(source||{}),editable:true,notes:['Prancha editável. Cotas governam a geometria quando a representação gráfica for esquemática.']};
}
export function normalizeEntity(entity,index=0){
  const kind=String(entity?.kind||'text'),id=String(entity?.id||`E${index+1}`),x=finite(`${id}.x`,entity?.x??0),y=finite(`${id}.y`,entity?.y??0);
  const base={id,kind,x,y,stroke:String(entity?.stroke||'#303942'),fill:String(entity?.fill||'none'),strokeWidth:Math.max(.1,finite(`${id}.strokeWidth`,entity?.strokeWidth??.7)),fontSize:Math.max(2,finite(`${id}.fontSize`,entity?.fontSize??4)),editable:entity?.editable!==false,metadata:clone(entity?.metadata||{})};
  if(kind==='line')return{...base,x2:finite(`${id}.x2`,entity?.x2??x+20),y2:finite(`${id}.y2`,entity?.y2??y)};
  if(kind==='rect')return{...base,width:Math.max(.1,finite(`${id}.width`,entity?.width??20)),height:Math.max(.1,finite(`${id}.height`,entity?.height??10))};
  if(kind==='dim')return{...base,x2:finite(`${id}.x2`,entity?.x2??x+20),y2:finite(`${id}.y2`,entity?.y2??y),offset:finite(`${id}.offset`,entity?.offset??8),valueMm:finite(`${id}.valueMm`,entity?.valueMm??Math.hypot((entity?.x2??x+20)-x,(entity?.y2??y)-y)),precision:Math.max(0,Math.round(finite(`${id}.precision`,entity?.precision??0)))};
  if(kind==='polyline'||kind==='rebar')return{...base,points:Array.from(entity?.points||[],(p,i)=>({x:finite(`${id}.points[${i}].x`,p?.x),y:finite(`${id}.points[${i}].y`,p?.y)})),label:String(entity?.label||''),diameterMm:entity?.diameterMm==null?null:finite(`${id}.diameterMm`,entity.diameterMm),quantity:entity?.quantity==null?null:Math.max(1,Math.round(finite(`${id}.quantity`,entity.quantity)))};
  return{...base,text:String(entity?.text??entity?.label??''),anchor:['start','middle','end'].includes(entity?.anchor)?entity.anchor:'start'};
}
function rebarEntity(mark,x,y,w=230){
  const segs=mark?.segmentsMm||[],total=Math.max(1,segs.reduce((s,v)=>s+Number(v||0),0)),points=[{x,y}],height=14;
  let cx=x;segs.forEach((len,i)=>{const dx=Math.max(12,w*Number(len||0)/total);cx+=dx;points.push({x:cx,y:y+(i%2?height:0)});});
  if(points.length===1)points.push({x:x+w*.6,y});
  return normalizeEntity({id:`BAR-${mark.id}`,kind:'rebar',x,y,points,label:`${mark.id} · ${mark.quantity}Ø${mark.diameterMm} · Lc=${Math.round(mark.cutLengthMm||0)} mm`,diameterMm:mark.diameterMm,quantity:mark.quantity,stroke:'#3b4a55',strokeWidth:1.2,metadata:{sourceMarkId:mark.id,segmentsMm:clone(segs),arcs:clone(mark.arcs||[]),location:mark.location||''}});
}
export function createRebarSheetsFromSchedule({schedule,projectId='',title='Detalhamento de armaduras',paper='A1',scale='1:25',revision='R0',marksPerSheet=8}={}){
  if(schedule?.contract!=='rebar-schedule/v1')throw new Error('DrawingSheet: schedule deve ser rebar-schedule/v1.');
  const per=Math.max(1,Math.min(16,Math.round(Number(marksPerSheet)||8))),marks=schedule.marks||[],pages=[];
  for(let page=0;page<Math.max(1,Math.ceil(marks.length/per));page++){const slice=marks.slice(page*per,(page+1)*per),entities=[];
    entities.push(normalizeEntity({id:'TITLE',kind:'text',x:25,y:28,text:`${title} · ${page+1}/${Math.max(1,Math.ceil(marks.length/per))}`,fontSize:7,stroke:'#1f2b33'}));
    entities.push(normalizeEntity({id:'NOTE',kind:'text',x:25,y:40,text:'Geometria editável; dimensões e marcas derivadas do schedule de dimensionamento.',fontSize:3.5,stroke:'#53616b'}));
    slice.forEach((mark,i)=>{const y=70+i*55;entities.push(rebarEntity(mark,45,y));entities.push(normalizeEntity({id:`TXT-${mark.id}`,kind:'text',x:300,y:y+4,text:`${mark.location||'Elemento'} · aço ${mark.grade||'—'} · ${Math.round(mark.totalLengthM*100)/100} m · ${Math.round(mark.totalMassKg*100)/100} kg`,fontSize:3.7,stroke:'#34444f'}));});
    const sheet=createDrawingSheet({id:`REB-${String(page+1).padStart(2,'0')}`,title,paper,scale,revision,projectId,entities,source:{type:'rebar-schedule',contract:schedule.contract,markIds:slice.map(m=>m.id)}});
    pages.push(sheet);
  }return pages;
}
export function updateSheetEntity(sheet,entityId,patch={}){
  if(sheet?.contract!==DRAWING_SHEET_CONTRACT)throw new Error('DrawingSheet: prancha inválida.');const s=clone(sheet),i=s.entities.findIndex(e=>String(e.id)===String(entityId));if(i<0)throw new Error(`DrawingSheet: entidade '${entityId}' não encontrada.`);s.entities[i]=normalizeEntity({...s.entities[i],...patch},i);return s;
}
export function moveSheetEntity(sheet,entityId,dx=0,dy=0){const e=sheet.entities.find(x=>String(x.id)===String(entityId));if(!e)throw new Error('DrawingSheet: entidade não encontrada.');const patch={x:e.x+finite('dx',dx),y:e.y+finite('dy',dy)};if(e.kind==='line'||e.kind==='dim'){patch.x2=e.x2+Number(dx);patch.y2=e.y2+Number(dy)}if(Array.isArray(e.points))patch.points=e.points.map(p=>({x:p.x+Number(dx),y:p.y+Number(dy)}));return updateSheetEntity(sheet,entityId,patch);}
export function sheetsFromProject(project){return Array.isArray(project?.drawingSheets)?clone(project.drawingSheets):[];}
export function withDrawingSheets(project,sheets){const p=clone(project||{});p.drawingSheets=Array.from(sheets||[],s=>{if(s?.contract!==DRAWING_SHEET_CONTRACT)throw new Error('DrawingSheet: contrato inválido.');return clone(s)});return p;}
export function findRebarSchedule(project){
  const candidates=[project?.detailing?.reinforcement,project?.detailingPackage?.reinforcement,project?.detailing?.package?.reinforcement,...(project?.detailingPackages||[]).map(x=>x?.reinforcement)];
  return candidates.find(x=>x?.contract==='rebar-schedule/v1')||null;
}
export function exportDrawingSheetSvg(sheet){
  if(sheet?.contract!==DRAWING_SHEET_CONTRACT)throw new Error('DrawingSheet: prancha inválida.');
  const body=sheet.entities.map(e=>{if(e.kind==='line')return`<line id="${esc(e.id)}" x1="${e.x}" y1="${e.y}" x2="${e.x2}" y2="${e.y2}" stroke="${esc(e.stroke)}" stroke-width="${e.strokeWidth}"/>`;if(e.kind==='rect')return`<rect id="${esc(e.id)}" x="${e.x}" y="${e.y}" width="${e.width}" height="${e.height}" fill="${esc(e.fill)}" stroke="${esc(e.stroke)}" stroke-width="${e.strokeWidth}"/>`;if(e.kind==='polyline'||e.kind==='rebar')return`<polyline id="${esc(e.id)}" points="${e.points.map(p=>`${p.x},${p.y}`).join(' ')}" fill="none" stroke="${esc(e.stroke)}" stroke-width="${e.strokeWidth}"/><text x="${e.x}" y="${e.y-5}" font-size="${e.fontSize}" fill="${esc(e.stroke)}">${esc(e.label)}</text>`;if(e.kind==='dim')return dimensionSvg(e);return`<text id="${esc(e.id)}" x="${e.x}" y="${e.y}" font-size="${e.fontSize}" text-anchor="${e.anchor}" fill="${esc(e.stroke)}">${esc(e.text)}</text>`}).join('');
  const border=`<rect x="10" y="10" width="${sheet.widthMm-20}" height="${sheet.heightMm-20}" fill="white" stroke="#26343e" stroke-width=".7"/><text x="${sheet.widthMm-20}" y="${sheet.heightMm-18}" text-anchor="end" font-size="4" fill="#26343e">${esc(sheet.id)} · ${esc(sheet.scale)} · ${esc(sheet.revision)}</text>`;
  return`<svg xmlns="http://www.w3.org/2000/svg" width="${sheet.widthMm}mm" height="${sheet.heightMm}mm" viewBox="0 0 ${sheet.widthMm} ${sheet.heightMm}" data-contract="${DRAWING_SHEET_CONTRACT}">${border}${body}</svg>`;
}

function dimensionSvg(e){
  const dx=e.x2-e.x,dy=e.y2-e.y,len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len,px=-uy,py=ux,off=e.offset;
  const a1={x:e.x+px*off,y:e.y+py*off},a2={x:e.x2+px*off,y:e.y2+py*off},mid={x:(a1.x+a2.x)/2,y:(a1.y+a2.y)/2-1},ah=1.6;
  const arrow=(tip,dirx,diry)=>{const bx=tip.x-dirx*ah,by=tip.y-diry*ah,nx=-diry*ah*.4,ny=dirx*ah*.4;return`<polygon points="${tip.x},${tip.y} ${bx+nx},${by+ny} ${bx-nx},${by-ny}" fill="${esc(e.stroke)}"/>`};
  return`<line x1="${e.x}" y1="${e.y}" x2="${a1.x}" y2="${a1.y}" stroke="${esc(e.stroke)}" stroke-width="${e.strokeWidth*.6}"/>`+
    `<line x1="${e.x2}" y1="${e.y2}" x2="${a2.x}" y2="${a2.y}" stroke="${esc(e.stroke)}" stroke-width="${e.strokeWidth*.6}"/>`+
    `<line id="${esc(e.id)}" x1="${a1.x}" y1="${a1.y}" x2="${a2.x}" y2="${a2.y}" stroke="${esc(e.stroke)}" stroke-width="${e.strokeWidth}"/>`+
    arrow(a1,ux,uy)+arrow(a2,-ux,-uy)+
    `<text x="${mid.x}" y="${mid.y}" font-size="${e.fontSize}" text-anchor="middle" fill="${esc(e.stroke)}">${esc(e.valueMm.toFixed(e.precision))}</text>`;
}
