from pathlib import Path

p=Path('web/src/solver/corotational2d.js')
s=p.read_text()
old="""  const control=resolveDisplacementControl(prepared,options.displacementControl||{}),steps=clamp(Math.round(Number(options.steps??20)||20),1,300),maxIterations=clamp(Math.round(Number(options.maxIterations??40)||40),3,120),tolerance=Math.max(1e-12,Number(options.tolerance??1e-8)||1e-8),controlTolerance=Math.max(1e-10,Number(options.displacementTolerance??1e-7)||1e-7),lineSearch=options.lineSearch!==false;"""
new="""  const control=resolveDisplacementControl(prepared,options.displacementControl||{}),steps=clamp(Math.round(Number(options.steps??20)||20),1,300),maxIterations=clamp(Math.round(Number(options.maxIterations??40)||40),3,120),tolerance=Math.max(1e-12,Number(options.tolerance??1e-8)||1e-8),absoluteTolerance=Math.max(1e-12,Number(options.absoluteTolerance??1e-9)||1e-9),controlTolerance=Math.max(1e-10,Number(options.displacementTolerance??1e-7)||1e-7),lineSearch=options.lineSearch!==false;"""
if old not in s:
    raise SystemExit('pushover tolerance declaration anchor not found')
s=s.replace(old,new,1)
s=s.replace("if(current.norm<=tolerance*scale&&Math.abs(controlError)<=controlTolAbs){converged=true;last=current;break}","if(current.norm<=Math.max(tolerance*scale,absoluteTolerance)&&Math.abs(controlError)<=controlTolAbs){converged=true;last=current;break}",1)
s=s.replace("if(current.norm<=tolerance*scale&&Math.abs(controlError)<=controlTolAbs){converged=true;last=current}","if(current.norm<=Math.max(tolerance*scale,absoluteTolerance)&&Math.abs(controlError)<=controlTolAbs){converged=true;last=current}",1)
s=s.replace("steps,maxIterations,tolerance,controlTolerance,lineSearch,finalLoadFactor", "steps,maxIterations,tolerance,absoluteTolerance,controlTolerance,lineSearch,finalLoadFactor",1)
p.write_text(s)
