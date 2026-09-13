const DIMS={
  dimensionless:[0,0,0,0],length:[0,1,0,0],force:[1,0,0,0],time:[0,0,1,0],temperature:[0,0,0,1],
  stress:[1,-2,0,0],moment:[1,1,0,0],forcePerLength:[1,-1,0,0],stiffness:[1,-1,0,0],lineLoad:[1,-1,0,0],
  area:[0,2,0,0],inertia:[0,4,0,0],velocity:[0,1,-1,0],acceleration:[0,1,-2,0]
};
const UNITS=new Map();
function define(symbol,dimension,factor){UNITS.set(symbol,{symbol,dimension:[...DIMS[dimension]],dimensionName:dimension,factor:Number(factor)})}

define('1','dimensionless',1);
define('m','length',1);define('cm','length',1e-2);define('mm','length',1e-3);
define('m2','area',1);define('cm2','area',1e-4);define('mm2','area',1e-6);
define('m4','inertia',1);define('cm4','inertia',1e-8);define('mm4','inertia',1e-12);
define('N','force',1);define('kN','force',1e3);define('MN','force',1e6);
define('Pa','stress',1);define('kPa','stress',1e3);define('MPa','stress',1e6);define('GPa','stress',1e9);define('N/mm2','stress',1e6);define('kN/m2','stress',1e3);
define('N*m','moment',1);define('kN*m','moment',1e3);define('N*mm','moment',1e-3);define('kN*mm','moment',1);
define('N/m','forcePerLength',1);define('kN/m','forcePerLength',1e3);define('N/mm','forcePerLength',1e3);
define('s','time',1);define('ms','time',1e-3);
define('K','temperature',1);define('degC','temperature',1);
define('m/s','velocity',1);define('mm/s','velocity',1e-3);
define('m/s2','acceleration',1);define('mm/s2','acceleration',1e-3);define('g','acceleration',9.80665);

function unitOf(symbol){const u=UNITS.get(String(symbol));if(!u)throw new Error(`Unidade não suportada: ${symbol}.`);return u}
export function sameDimension(a,b){const da=Array.isArray(a)?a:unitOf(a).dimension,db=Array.isArray(b)?b:unitOf(b).dimension;return da.length===db.length&&da.every((v,i)=>v===db[i])}
export function convertUnit(value,from,to){const a=unitOf(from),b=unitOf(to);if(!sameDimension(a.dimension,b.dimension))throw new Error(`Conversão dimensional inválida: ${from} → ${to}.`);const v=Number(value);if(!Number.isFinite(v))throw new Error(`Valor não finito para conversão ${from} → ${to}.`);return v*a.factor/b.factor}
export function toBaseUnit(value,unit){const u=unitOf(unit),v=Number(value);if(!Number.isFinite(v))throw new Error(`Valor não finito para unidade ${unit}.`);return{value:v*u.factor,dimension:[...u.dimension],dimensionName:u.dimensionName}}
export function unitMetadata(symbol){const u=unitOf(symbol);return{...u,dimension:[...u.dimension]}}
export function assertUnitDimension(symbol,expected){const u=unitOf(symbol),dimension=Array.isArray(expected)?expected:DIMS[expected];if(!dimension)throw new Error(`Dimensão desconhecida: ${expected}.`);if(!sameDimension(u.dimension,dimension))throw new Error(`Unidade ${symbol} possui dimensão ${u.dimensionName}; esperado ${Array.isArray(expected)?expected.join(','):expected}.`);return true}
export function listUnits(dimensionName=null){const dimension=dimensionName?DIMS[dimensionName]:null;if(dimensionName&&!dimension)throw new Error(`Dimensão desconhecida: ${dimensionName}.`);return[...UNITS.values()].filter(u=>!dimension||sameDimension(u.dimension,dimension)).map(u=>({...u,dimension:[...u.dimension]}))}
export const STRUCTURAL_DIMENSIONS=Object.freeze(Object.fromEntries(Object.entries(DIMS).map(([k,v])=>[k,Object.freeze([...v])])));
