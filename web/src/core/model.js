export const uid=(p='id')=>`${p}_${Math.random().toString(36).slice(2,9)}`;

export const MATERIALS=[
  {id:'concrete30',name:'Concreto C30 (exemplo)',type:'concrete',E:30e6,nu:.2,density:25,fck:30,fy:null,unit:'kN/m²',verified:false},
  {id:'steel355',name:'Aço estrutural fy=355 MPa (exemplo)',type:'steel',E:200e6,nu:.3,density:78.5,fy:355,fu:510,unit:'kN/m²',verified:false},
];

export function emptyProject(){return {id:uid('project'),name:'Novo projeto',version:1,units:'kN-m-MPa',nodes:[],elements:[],materials:[...MATERIALS],sections:[],supports:[],loads:[],connections:[],results:null,meta:{solverVersion:'0.1.0',createdAt:new Date().toISOString()}}}

export function demoFrame(){
  const p=emptyProject();p.name='Pórtico demonstrativo';
  p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:0,y:3},{id:'N3',x:5,y:3},{id:'N4',x:5,y:0}];
  p.elements=[
    {id:'E1',type:'frame2d',n1:'N1',n2:'N2',materialId:'concrete30',A:.15,I:.003125,label:'Pilar 1'},
    {id:'E2',type:'frame2d',n1:'N2',n2:'N3',materialId:'concrete30',A:.15,I:.003125,label:'Viga'},
    {id:'E3',type:'frame2d',n1:'N3',n2:'N4',materialId:'concrete30',A:.15,I:.003125,label:'Pilar 2'}
  ];
  p.supports=[{nodeId:'N1',ux:true,uy:true,rz:true},{nodeId:'N4',ux:true,uy:true,rz:true}];
  p.loads=[{id:'L1',nodeId:'N2',fx:20,fy:0,mz:0},{id:'L2',nodeId:'N3',fx:0,fy:-40,mz:0}];
  return p;
}

export function demoTruss(){
  const p=emptyProject();p.name='Treliça demonstrativa';
  p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:4,y:0},{id:'N3',x:2,y:3}];
  p.elements=[
    {id:'E1',type:'truss2d',n1:'N1',n2:'N3',materialId:'steel355',A:.004,I:0,label:'Barra 1'},
    {id:'E2',type:'truss2d',n1:'N3',n2:'N2',materialId:'steel355',A:.004,I:0,label:'Barra 2'},
    {id:'E3',type:'truss2d',n1:'N1',n2:'N2',materialId:'steel355',A:.004,I:0,label:'Barra 3'}
  ];
  p.supports=[{nodeId:'N1',ux:true,uy:true,rz:false},{nodeId:'N2',ux:false,uy:true,rz:false}];
  p.loads=[{id:'L1',nodeId:'N3',fx:0,fy:-100,mz:0}];
  return p;
}
