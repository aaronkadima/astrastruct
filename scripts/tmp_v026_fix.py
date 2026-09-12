from pathlib import Path
p=Path('app/src/App.tsx')
s=p.read_text()
old="Number(f.N1??-f.axialForce??0)"
new="Number(f.N1 ?? (f.axialForce!=null ? -f.axialForce : 0))"
if old not in s:
    raise SystemExit('v0.26 JSX fix anchor not found')
p.write_text(s.replace(old,new,1))
print('v0.26 JSX fix applied')
