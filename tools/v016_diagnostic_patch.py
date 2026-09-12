from pathlib import Path

p=Path('web/src/solver/corotational2d.js')
s=p.read_text()
old="    if(!converged)throw new Error(`Pushover não convergiu no passo ${step}/${steps} em ${maxIterations} iterações.`);"
new="    if(!converged){const diagnostic=residualAt(prepared,u,lambda,options),controlError=target-u[control.index],scale=residualScale(prepared,diagnostic,lambda);throw new Error(`Pushover não convergiu no passo ${step}/${steps} em ${maxIterations} iterações: lambda=${lambda}, u=${u[control.index]}, alvo=${target}, erroControle=${controlError}, |R|=${diagnostic.norm}, escalaR=${scale}.`)}"
if old not in s:
    raise SystemExit('pushover diagnostic anchor not found')
s=s.replace(old,new,1)
p.write_text(s)
