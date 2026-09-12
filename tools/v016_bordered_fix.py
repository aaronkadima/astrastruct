from pathlib import Path

p=Path('web/src/solver/corotational2d.js')
s=p.read_text()
old="""      const Kff=prepared.free.map(i=>prepared.free.map(j=>current.K[i][j])),rf=prepared.free.map(i=>current.residual[i]),dRdl=residualLoadDerivative(prepared,u,lambda,options),pf=prepared.free.map(i=>dRdl[i]);let a,b;
      try{a=solveLinear(Kff,rf);b=solveLinear(Kff,pf)}catch(e){throw new Error(`Pushover: tangente singular no passo ${step}, iteração ${iteration}. ${e.message||e}`)}
      const influence=b[control.freePosition];
      if(!(Number.isFinite(influence)&&Math.abs(influence)>1e-14))throw new Error(`Pushover: o padrão de carga possui influência praticamente nula em ${control.nodeId}/${control.dof}.`);
      const dLambda=(controlError-a[control.freePosition])/influence,du=a.map((v,i)=>v+b[i]*dLambda),currentMerit=displacementControlMerit(prepared,current,controlError,lambda,control.targetDisplacement);let eta=1,next=null;"""
new="""      const Kff=prepared.free.map(i=>prepared.free.map(j=>current.K[i][j])),rf=prepared.free.map(i=>current.residual[i]),dRdl=residualLoadDerivative(prepared,u,lambda,options),pf=prepared.free.map(i=>dRdl[i]),nf=prepared.free.length,augmented=Kff.map((row,i)=>[...row,-pf[i]]),constraint=Array(nf+1).fill(0);constraint[control.freePosition]=1;augmented.push(constraint);let correction;
      try{correction=solveLinear(augmented,[...rf,controlError])}catch(e){throw new Error(`Pushover: sistema aumentado singular no passo ${step}, iteração ${iteration}. O padrão de carga pode não controlar ${control.nodeId}/${control.dof}. ${e.message||e}`)}
      const du=correction.slice(0,nf),dLambda=correction[nf];
      if(!(Number.isFinite(dLambda)&&du.every(Number.isFinite)))throw new Error(`Pushover: correção aumentada inválida no passo ${step}, iteração ${iteration}.`);
      const currentMerit=displacementControlMerit(prepared,current,controlError,lambda,control.targetDisplacement);let eta=1,next=null;"""
if old not in s:
    raise SystemExit('bordered Newton anchor not found')
s=s.replace(old,new,1)
p.write_text(s)
