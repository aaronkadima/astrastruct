// Longitudinal rebar layout within a rectangular cross-section (mm units,
// matching the detailing/codeDesign convention — see rebarShapes.js). This
// is layout GEOMETRY only: deciding how many bars and what diameter satisfy
// a required As is an engineering/design decision the caller must make
// (e.g. from `rcFlexureDesign`'s output elsewhere in codeDesign/rc.js);
// this module only distributes an already-chosen bar count into positions
// with proper corner anchoring and face cover, given cover + stirrup +
// bar diameters (needed to know the true offset from the section face to
// each bar's own centroid).
const finite=(name,v)=>{const n=Number(v);if(!Number.isFinite(n))throw new Error(`RebarLayout: ${name} deve ser finito.`);return n};
const positive=(name,v)=>{const n=finite(name,v);if(!(n>0))throw new Error(`RebarLayout: ${name} deve ser > 0.`);return n};
const nonnegative=(name,v)=>{const n=finite(name,v);if(n<0)throw new Error(`RebarLayout: ${name} deve ser >= 0.`);return n};

/**
 * Longitudinal bar positions in section-LOCAL (y,z) coordinates, centered on
 * the section centroid (y along the element's local `ey`, z along `ez` —
 * see elementAxes3D in view/spatialView3d.js). 4 corner bars are always
 * placed first; any remaining bars are split evenly between the top and
 * bottom faces. This is a common simplified layout (not a code-specific
 * arrangement) — side bars for deep sections, or unequal top/bottom counts
 * for asymmetric flexural reinforcement, are not modeled here yet.
 */
export function rectangularSectionBarLayout({widthMm,heightMm,coverMm,stirrupDiameterMm,barDiameterMm,totalBars}={}){
  const b=positive('widthMm',widthMm),h=positive('heightMm',heightMm),cover=nonnegative('coverMm',coverMm),dStirrup=nonnegative('stirrupDiameterMm',stirrupDiameterMm),phi=positive('barDiameterMm',barDiameterMm),n=Math.max(4,Math.round(Number(totalBars)||4));
  const edgeOffset=cover+dStirrup+phi/2,yMax=b/2-edgeOffset,zMax=h/2-edgeOffset;
  if(!(yMax>0)||!(zMax>0))throw new Error('RebarLayout: cobrimento + estribo + barra excede a seção informada — não há espaço para posicionar as barras.');
  const corners=[[-yMax,-zMax],[yMax,-zMax],[yMax,zMax],[-yMax,zMax]],remaining=Math.max(0,n-4),perTop=Math.ceil(remaining/2),perBottom=remaining-perTop;
  const topBars=Array.from({length:perTop},(_,i)=>[-yMax+(i+1)*(2*yMax)/(perTop+1),-zMax]),bottomBars=Array.from({length:perBottom},(_,i)=>[-yMax+(i+1)*(2*yMax)/(perBottom+1),zMax]);
  const positions=[...corners,...topBars,...bottomBars].map(([y,z],i)=>({id:i+1,y,z,diameterMm:phi}));
  return{contract:'rebar-longitudinal-layout/v1',widthMm:b,heightMm:h,coverMm:cover,stirrupDiameterMm:dStirrup,barDiameterMm:phi,barCount:positions.length,positions};
}

/**
 * Common commercially-available rebar diameters (mm) — NOT a normative
 * table, just physical product sizes; confirm local mill/supplier
 * availability before specifying. Kept here (not in codeDesign/) because
 * choosing among them is a detailing/procurement decision, not a code
 * mechanics one.
 */
export const STANDARD_BAR_DIAMETERS_MM=Object.freeze([6.3,8,10,12.5,16,20,25,32]);

/**
 * Given a required steel area, finds the (diameter, bar count) combination
 * with the LEAST excess area ("waste") among a set of candidate diameters,
 * subject to a bar-count range. Ties on waste are broken toward fewer bars
 * (usually easier to place and tie). This is a plain combinatorial search,
 * not a code rule — spacing/cover feasibility for the chosen count is
 * `rectangularSectionBarLayout`'s job, not this function's.
 */
export function pickBarCountAndDiameter({requiredAsMm2,minBars=4,maxBars=12,diametersMm=STANDARD_BAR_DIAMETERS_MM}={}){
  const As=positive('requiredAsMm2',requiredAsMm2),lo=Math.max(4,Math.round(Number(minBars)||4)),hi=Math.max(lo,Math.round(Number(maxBars)||12));
  let best=null;
  for(const d of diametersMm){
    const areaPerBar=Math.PI*d*d/4;
    for(let n=lo;n<=hi;n++){
      const totalAreaMm2=n*areaPerBar;
      if(totalAreaMm2+1e-9<As)continue;
      const waste=totalAreaMm2-As;
      if(!best||waste<best.waste-1e-9||(Math.abs(waste-best.waste)<=1e-9&&n<best.barCount))best={barCount:n,diameterMm:d,totalAreaMm2,waste};
      break; // larger n at this same diameter only adds more area once satisfied
    }
  }
  if(!best)throw new Error(`RebarLayout: nenhuma combinação entre as bitolas [${diametersMm.join(', ')}]mm e até ${hi} barras atinge As=${As}mm² — aumente maxBars ou amplie diametersMm.`);
  return{contract:'bar-count-diameter-pick/v1',requiredAsMm2:As,...best};
}

/**
 * Closes the loop from a required steel area straight to a placed layout:
 * picks a (diameter, count) combination, then lays it out — the actual
 * "automation" step the earlier stirrup/bar automation was missing for
 * longitudinal reinforcement. `sizing` on the result carries the pick
 * (including how much area is "wasted" over the exact requirement), so the
 * chosen count/diameter is always traceable back to the As it came from —
 * never silently baked in.
 */
export function autoRectangularSectionBarLayout({widthMm,heightMm,coverMm,stirrupDiameterMm,requiredAsMm2,minBars=4,maxBars=12,diametersMm=STANDARD_BAR_DIAMETERS_MM}={}){
  const sizing=pickBarCountAndDiameter({requiredAsMm2,minBars,maxBars,diametersMm});
  const layout=rectangularSectionBarLayout({widthMm,heightMm,coverMm,stirrupDiameterMm,barDiameterMm:sizing.diameterMm,totalBars:sizing.barCount});
  return{...layout,sizing};
}
