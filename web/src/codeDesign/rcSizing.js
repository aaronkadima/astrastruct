// Inverse of rcRectangularFlexureDesign: given a target Mu (and the same
// section/material/profile inputs the check already uses), solves for the
// MINIMUM As that satisfies phi*Mn(As) >= Mu — by bisecting on the exact
// same check function. This is deliberate: there is exactly one place
// (rc.js's rcRectangularFlexureDesign) that knows the flexural mechanics;
// this module never reimplements the formula, so the sizing result and the
// check result can never silently disagree with each other.
import {rcRectangularFlexureDesign,rcShearDesign} from './rc.js';
import {requiredFinite,requiredPositive} from './engine.js';

export function rcFlexureRequiredAs({profile,demand={},section={},materials={},asMinMm2,asMaxMm2,tolerance=1e-6,maxIterations=100}={}){
  const target=Math.abs(requiredFinite('demand.Mu',demand.Mu)),lo0=requiredPositive('asMinMm2',asMinMm2),hi0=requiredPositive('asMaxMm2',asMaxMm2);
  if(!(hi0>lo0))throw new Error('CodeDesign RC sizing: asMaxMm2 deve ser maior que asMinMm2.');
  const resistanceAt=As=>rcRectangularFlexureDesign({profile,demand,section,reinforcement:{As},materials}).resistance;
  const rLo=resistanceAt(lo0);
  if(rLo>=target)return{contract:'rc-flexure-required-as/v1',requiredAsMm2:lo0,resistance:rLo,demand:target,iterations:0,note:'asMinMm2 já atende à demanda — nenhuma busca necessária.'};
  const rHi=resistanceAt(hi0);
  if(rHi<target)throw new Error(`CodeDesign RC sizing: mesmo com As=asMaxMm2 (${hi0}mm²) a resistência (${rHi.toFixed(3)}) não atinge a demanda (${target}) — aumente asMaxMm2 ou revise a seção/materiais.`);
  let lo=lo0,hi=hi0,mid=hi0,rMid=rHi,iterations=0;
  for(;iterations<maxIterations;iterations++){mid=.5*(lo+hi);rMid=resistanceAt(mid);if(Math.abs(rMid-target)<=tolerance*Math.max(1,target))break;if(rMid<target)lo=mid;else hi=mid;}
  return{contract:'rc-flexure-required-as/v1',requiredAsMm2:mid,resistance:rMid,demand:target,iterations};
}

/**
 * Inverse of rcShearDesign along the OTHER free variable: given a chosen
 * stirrup diameter and leg count (Av is then fixed), finds the LARGEST
 * spacing `s` that still satisfies Vu — resistance decreases monotonically
 * as s grows, so this is the same bisection idea as rcFlexureRequiredAs but
 * searching for the loosest (most economical) spacing that still works,
 * bounded by [sMinMm, sMaxMm] the caller supplies (this module asserts no
 * normative min/max stirrup spacing itself — see rcShearDesign's own note).
 */
export function rcShearRequiredSpacing({profile,demand={},section={},materials={},stirrupDiameterMm,legs=2,sMinMm,sMaxMm,tolerance=1e-6,maxIterations=100}={}){
  const target=Math.abs(requiredFinite('demand.Vu',demand.Vu)),dPhi=requiredPositive('stirrupDiameterMm',stirrupDiameterMm),nLegs=requiredPositive('legs',legs),sMin=requiredPositive('sMinMm',sMinMm),sMax=requiredPositive('sMaxMm',sMaxMm);
  if(!(sMax>sMin))throw new Error('CodeDesign RC sizing: sMaxMm deve ser maior que sMinMm.');
  const Av=nLegs*Math.PI*dPhi*dPhi/4,resistanceAt=s=>rcShearDesign({profile,demand,section,reinforcement:{Av,s},materials}).resistance;
  const rMin=resistanceAt(sMin);
  if(rMin<target)throw new Error(`CodeDesign RC sizing: mesmo no espaçamento mínimo (${sMin}mm) a resistência (${rMin.toFixed(3)}) não atinge a demanda (${target}) — aumente a bitola/nº de pernas do estribo ou reduza sMinMm.`);
  const rMax=resistanceAt(sMax);
  if(rMax>=target)return{contract:'rc-shear-required-spacing/v1',spacingMm:sMax,Av,resistance:rMax,demand:target,iterations:0,note:'sMaxMm já atende à demanda — nenhuma busca necessária.'};
  let lo=sMin,hi=sMax,mid=sMin,rMid=rMin,iterations=0;
  for(;iterations<maxIterations;iterations++){mid=.5*(lo+hi);rMid=resistanceAt(mid);if(Math.abs(rMid-target)<=tolerance*Math.max(1,target))break;if(rMid>=target)lo=mid;else hi=mid;}
  return{contract:'rc-shear-required-spacing/v1',spacingMm:mid,Av,resistance:rMid,demand:target,iterations};
}

/**
 * Rounds a computed spacing DOWN to a buildable increment (e.g. every 25mm)
 * — rounding down is the safe direction here (smaller spacing = more steel
 * = more resistance, never less than what the raw search found adequate).
 * Never rounds below `sMinMm` even if that isn't itself a multiple of the
 * increment.
 */
export function roundSpacingDownMm(spacingMm,incrementMm=25,sMinMm=incrementMm){
  const s=requiredPositive('spacingMm',spacingMm),inc=requiredPositive('incrementMm',incrementMm),floor=requiredPositive('sMinMm',sMinMm);
  return Math.max(floor,Math.floor(s/inc)*inc);
}

/**
 * Closes the shear loop the same way `autoRectangularSectionBarLayout` does
 * for flexure: solves for the required spacing, then rounds it down to a
 * buildable increment, re-checking that the rounded value still satisfies
 * the original demand (it must, by construction, but this is verified
 * rather than assumed) before returning it.
 */
export function autoStirrupSpacing({profile,demand={},section={},materials={},stirrupDiameterMm,legs=2,sMinMm,sMaxMm,roundToMm=25}={}){
  const raw=rcShearRequiredSpacing({profile,demand,section,materials,stirrupDiameterMm,legs,sMinMm,sMaxMm});
  const rounded=roundSpacingDownMm(raw.spacingMm,roundToMm,sMinMm);
  const check=rcShearDesign({profile,demand,section,reinforcement:{Av:raw.Av,s:rounded},materials});
  if(!check.ok)throw new Error(`CodeDesign RC sizing: espaçamento arredondado (${rounded}mm) não confirma na verificação final (utilização ${check.utilization}) — isto não deveria acontecer para arredondamento para baixo; revise sMinMm/roundToMm.`);
  return{contract:'auto-stirrup-spacing/v1',spacingMm:rounded,rawSpacingMm:raw.spacingMm,Av:raw.Av,stirrupDiameterMm,legs,finalUtilization:check.utilization};
}
