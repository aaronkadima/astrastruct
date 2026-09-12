from pathlib import Path

p=Path('tests/e2e/material-nonlinear.spec.ts')
s=p.read_text()
s=s.replace('v0.14 fiber hinge is configured, guarded, solved and traced through postprocess/report','v0.16 fiber hinge is configured, guarded, solved and traced through postprocess/report')
s=s.replace("p.name='E2E — rótula de fibras v0.14'","p.name='E2E — rótula de fibras v0.16'")
s=s.replace('Não linearidade material v0.15','Não linearidade material v0.16')
s=s.replace('0.15.0-exp','0.16.0-exp')
p.write_text(s)
