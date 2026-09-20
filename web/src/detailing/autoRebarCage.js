// Orchestrates the full "design -> detail -> 3D geometry" chain for one
// frame3d element: flexure demand -> required As -> bar count/diameter ->
// section layout; shear demand -> required stirrup spacing -> stirrup
// geometry; both then feed elementRebarCage3d. This introduces NO new
// engineering mechanics — every number here traces back to
// rcFlexureRequiredAs / rcShearRequiredSpacing / pickBarCountAndDiameter /
// rectangularStirrupGeometry / elementRebarCage3d, each already tested on
// its own. This module only wires them together and re-verifies the final
// picks against the original demand before returning anything.
import {rcFlexureRequiredAs,rcShearRequiredSpacing,roundSpacingDownMm} from '../codeDesign/rcSizing.js';
import {rcShearDesign} from '../codeDesign/rc.js';
import {autoRectangularSectionBarLayout} from './rebarLayout.js';
import {rectangularStirrupGeometry} from './rebarShapes.js';
import {elementRebarCage3d} from '../view/rebarCage3d.js';

const finite=(name,v)=>{const n=Number(v);if(!Number.isFinite(n))throw new Error(`AutoRebarCage: ${name} deve ser finito.`);return n};
const positive=(name,v)=>{const n=finite(name,v);if(!(n>0))throw new Error(`AutoRebarCage: ${name} deve ser > 0.`);return n};

/**
 * `rcProfile` supplies profile.parameters.rc.flexure/shear (codeDesign
 * mechanics); `detailingProfile` supplies profile.parameters.detailing.bend/
 * hook (bend/hook geometry) — usually the same object, kept separate here
 * only because they are two independent concerns that could, in principle,
 * come from different plugins.
 */
export function autoElementRebarCage3d({
  project,element,demand={},section={},materials={},
  rcProfile,detailingProfile,
  coverMm,stirrupDiameterMm,stirrupLegs=2,hookAngleDeg=135,
  longitudinal={},spacing={},asBounds={},cage={},
}={}){
  const widthMm=positive('section.widthMm',section.widthMm),heightMm=positive('section.heightMm',section.heightMm),d=positive('section.effectiveDepthMm',section.effectiveDepthMm),cover=finite('coverMm',coverMm),dStirrup=positive('stirrupDiameterMm',stirrupDiameterMm);

  // --- Flexure: Mu -> As -> bar pick -> layout ---
  const flexureSizing=rcFlexureRequiredAs({profile:rcProfile,demand,section:{b:widthMm,d},materials,asMinMm2:asBounds.asMinMm2,asMaxMm2:asBounds.asMaxMm2});
  const layout=autoRectangularSectionBarLayout({widthMm,heightMm,coverMm:cover,stirrupDiameterMm:dStirrup,requiredAsMm2:flexureSizing.requiredAsMm2,minBars:longitudinal.minBars,maxBars:longitudinal.maxBars,diametersMm:longitudinal.diametersMm});

  // --- Shear: Vu -> spacing -> round -> re-verify against the ORIGINAL demand ---
  const shearRaw=rcShearRequiredSpacing({profile:rcProfile,demand,section:{bw:widthMm,d},materials,stirrupDiameterMm:dStirrup,legs:stirrupLegs,sMinMm:spacing.sMinMm,sMaxMm:spacing.sMaxMm});
  const spacingMm=roundSpacingDownMm(shearRaw.spacingMm,spacing.roundToMm??25,spacing.sMinMm);
  const shearCheck=rcShearDesign({profile:rcProfile,demand,section:{bw:widthMm,d},reinforcement:{Av:shearRaw.Av,s:spacingMm},materials});
  if(!shearCheck.ok)throw new Error(`AutoRebarCage: espaçamento de estribo arredondado (${spacingMm}mm) não confirma na verificação final de cisalhamento (utilização ${shearCheck.utilization}).`);

  // --- Stirrup geometry: encloses the longitudinal cage (section minus cover + its own diameter) ---
  const stirrup=rectangularStirrupGeometry({profile:detailingProfile,widthMm:widthMm-2*cover-dStirrup,heightMm:heightMm-2*cover-dStirrup,diameterMm:dStirrup,hookAngleDeg});

  // --- 3D cage: the same generator already validated on its own ---
  const cage3d=elementRebarCage3d({project,element,layout,stirrup,stirrupSpacingMm:spacingMm,startCoverMm:cage.startCoverMm??cover,endCoverMm:cage.endCoverMm??cover,segments:cage.segments});

  return{
    contract:'auto-rebar-cage-3d/v1',elementId:element.id,
    flexureSizing:{...flexureSizing,barPick:layout.sizing},
    shearSizing:{...shearRaw,spacingMm,finalUtilization:shearCheck.utilization},
    layout,stirrup,cage:cage3d,
  };
}
