export const TIME_DEPENDENT_EFFECTS_CONTRACT='time-dependent-effects/v1';
const finite=(name,v,f=0)=>{const n=Number(v??f);if(!Number.isFinite(n))throw new Error(`TimeEffects: ${name} deve ser finito.`);return n};
const positive=(name,v)=>{const n=finite(name,v);if(!(n>0))throw new Error(`TimeEffects: ${name} deve ser positivo.`);return n};
const dt=(time,start)=>Math.max(0,finite('timeDays',time)-finite('startDay',start));

/** User-parameterized asymptotic law; no code-specific coefficients are embedded. */
export function creepCoefficient({timeDays,loadingAgeDays=0,ultimate=0,timeConstantDays=365,exponent=1}={}){
  const d=dt(timeDays,loadingAgeDays),phiInf=Math.max(0,finite('ultimate creep',ultimate)),tau=positive('timeConstantDays',timeConstantDays),m=positive('exponent',exponent),beta=(1-Math.exp(-d/tau))**m;return{contract:TIME_DEPENDENT_EFFECTS_CONTRACT,value:phiInf*beta,beta,elapsedDays:d,ultimate:phiInf};
}
export function shrinkageStrain({timeDays,startDay=0,ultimate=0,timeConstantDays=180,exponent=1}={}){
  const d=dt(timeDays,startDay),epsInf=finite('ultimate shrinkage',ultimate),tau=positive('timeConstantDays',timeConstantDays),m=positive('exponent',exponent),beta=(1-Math.exp(-d/tau))**m;return{contract:TIME_DEPENDENT_EFFECTS_CONTRACT,value:epsInf*beta,beta,elapsedDays:d,ultimate:epsInf};
}
export function prestressRelaxation({timeDays,startDay=0,initialForce,ultimateLossRatio=0,timeConstantDays=1000,exponent=1}={}){
  const P0=Math.max(0,finite('initialForce',initialForce)),d=dt(timeDays,startDay),lossInf=Math.max(0,Math.min(1,finite('ultimateLossRatio',ultimateLossRatio))),tau=positive('timeConstantDays',timeConstantDays),m=positive('exponent',exponent),beta=(1-Math.exp(-d/tau))**m,lossRatio=lossInf*beta,effectiveForce=P0*(1-lossRatio);return{contract:TIME_DEPENDENT_EFFECTS_CONTRACT,initialForce:P0,effectiveForce,loss:P0-effectiveForce,lossRatio,beta,elapsedDays:d};
}
export function ageAdjustedEffectiveModulus({E,creep=0,agingCoefficient=.8}={}){const Em=positive('E',E),phi=Math.max(0,finite('creep',creep)),chi=Math.max(0,Math.min(1,finite('agingCoefficient',agingCoefficient,.8)));return{contract:TIME_DEPENDENT_EFFECTS_CONTRACT,E:Em,creep:phi,agingCoefficient:chi,effectiveModulus:Em/(1+chi*phi)} }

export function timeDependentState({timeDays,loadingAgeDays=0,E,creep=null,shrinkage=null,prestress=null,agingCoefficient=.8}={}){
  const cr=creep?creepCoefficient({timeDays,loadingAgeDays,...creep}):{value:0},sh=shrinkage?shrinkageStrain({timeDays,...shrinkage}):{value:0},aa=E?ageAdjustedEffectiveModulus({E,creep:cr.value,agingCoefficient}):null,pr=prestress?prestressRelaxation({timeDays,...prestress}):null;return{contract:TIME_DEPENDENT_EFFECTS_CONTRACT,timeDays:finite('timeDays',timeDays),loadingAgeDays:finite('loadingAgeDays',loadingAgeDays),creepCoefficient:cr.value,shrinkageStrain:sh.value,ageAdjusted:aa,prestress:pr};
}
