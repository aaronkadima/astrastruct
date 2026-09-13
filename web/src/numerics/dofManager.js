function key(owner,label){return `${String(owner)}::${String(label)}`}

export class DofManager {
  constructor(){this._byKey=new Map();this._descriptors=[];this._owners=new Map()}
  register(owner,label,metadata={}){
    const ownerId=String(owner??'').trim(),dofLabel=String(label??'').trim();
    if(!ownerId||!dofLabel)throw new Error('DofManager: owner e label são obrigatórios.');
    const k=key(ownerId,dofLabel);if(this._byKey.has(k))return this._byKey.get(k);
    const index=this._descriptors.length,descriptor={index,owner:ownerId,label:dofLabel,...metadata};
    this._byKey.set(k,index);this._descriptors.push(descriptor);
    if(!this._owners.has(ownerId))this._owners.set(ownerId,new Map());this._owners.get(ownerId).set(dofLabel,index);
    return index;
  }
  registerNode(nodeId,labels=['ux','uy','rz'],metadata={}){const out={};for(const label of labels)out[label]=this.register(nodeId,label,{kind:'node',nodeId:String(nodeId),...metadata});return out}
  has(owner,label){return this._byKey.has(key(String(owner),String(label)))}
  get(owner,label){const i=this._byKey.get(key(String(owner),String(label)));if(i==null)throw new Error(`DofManager: DOF não registrado ${owner}/${label}.`);return i}
  maybe(owner,label){return this._byKey.get(key(String(owner),String(label)))??null}
  indices(owner,labels=null){
    const map=this._owners.get(String(owner));if(!map)return[];
    if(labels==null)return[...map.values()];return labels.map(label=>this.get(owner,label));
  }
  descriptor(index){if(!Number.isInteger(index)||index<0||index>=this._descriptors.length)throw new RangeError(`DofManager: índice inválido ${index}.`);return {...this._descriptors[index]}}
  descriptors(){return this._descriptors.map(d=>({...d}))}
  ownerDofs(owner){const map=this._owners.get(String(owner));return map?Object.fromEntries(map):{}}
  get count(){return this._descriptors.length}
  assertVector(vector,label='vetor global'){if(vector.length!==this.count)throw new Error(`DofManager: ${label} possui ${vector.length} entradas; esperado ${this.count}.`);return vector}
}

export function createNodeDofManager(nodes,labels=['ux','uy','rz']){
  const manager=new DofManager();for(const node of nodes||[])manager.registerNode(node.id,labels);return manager;
}
