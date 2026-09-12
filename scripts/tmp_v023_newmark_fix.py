from pathlib import Path
p=Path('web/src/solver/dynamics2d.js')
s=p.read_text()
old="const n=K.length,h=Number(dt),T=Number(duration);if(!(h>0&&T>0))throw new Error('Newmark: dt e duração devem ser positivos.');const steps=Math.max(1,Math.ceil(T/h)),stepDt=T/steps,b=Number(beta),g=Number(gamma);if(!(b>0&&g>0))throw new Error('Newmark: beta e gamma devem ser positivos.');let u=u0?[...u0]:Array(n).fill(0),v=v0?[...v0]:Array(n).fill(0),a=Array(n).fill(0);const p0=forceAtTime(0),p0norm=Math.max(0,...p0.map(Math.abs));if(!u0&&!v0&&p0norm>1e-10)throw new Error('Newmark v0.23 parte de repouso e requer força dinâmica nula em t=0. Faça a história de escala iniciar em 0.');"
new="const n=K.length,h=Number(dt),T=Number(duration);if(!(h>0&&T>0))throw new Error('Newmark: dt e duração devem ser positivos.');const steps=Math.max(1,Math.ceil(T/h)),stepDt=T/steps,b=Number(beta),g=Number(gamma);if(!(b>0&&g>0))throw new Error('Newmark: beta e gamma devem ser positivos.');let u=u0?[...u0]:Array(n).fill(0),v=v0?[...v0]:Array(n).fill(0),a=Array(n).fill(0);const p0=forceAtTime(0),p0norm=Math.max(0,...p0.map(Math.abs)),hasInitial=!!u0||!!v0;if(!hasInitial&&p0norm>1e-10)throw new Error('Newmark v0.23 parte de repouso e requer força dinâmica nula em t=0. Faça a história de escala iniciar em 0.');if(hasInitial){const rhs0=p0.map((x,i)=>x-mul(C,v)[i]-mul(K,u)[i]);try{a=solveLinear(M,rhs0)}catch{throw new Error('Newmark: a matriz de massa é singular para o estado inicial imposto. Use massa consistente ou condições iniciais compatíveis com os DOFs inerciais.')}}"
if new not in s:
    if old not in s: raise SystemExit('Newmark initial-state anchor missing')
    s=s.replace(old,new)
p.write_text(s)
