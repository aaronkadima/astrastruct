function canonical(value){
  if(value===null||typeof value!=='object')return value;
  if(Array.isArray(value))return value.map(canonical);
  const out={};
  for(const key of Object.keys(value).sort()){
    const item=value[key];
    if(item!==undefined)out[key]=canonical(item);
  }
  return out;
}
export function stableStringify(value){return JSON.stringify(canonical(value));}
export function fnv1a32(value){
  const text=typeof value==='string'?value:stableStringify(value);
  let hash=0x811c9dc5;
  for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,0x01000193)>>>0;}
  return hash.toString(16).padStart(8,'0');
}
export function fingerprint(value){return `fnv1a32:${fnv1a32(value)}`;}
