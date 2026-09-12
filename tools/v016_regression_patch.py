from pathlib import Path

p=Path('tests/material-global-smoke.mjs')
s=p.read_text()
s=s.replace("r.solverVersion==='0.15.0-exp'","r.solverVersion==='0.16.0-exp'",1)
s=s.replace('v0.14.2 global: solverVersion inesperada','v0.16 global: solverVersion inesperada',1)
s=s.replace("console.log('Todos os smoke tests globais de rótula de fibras do AstraStruct v0.15 passaram.');","console.log('Todos os smoke tests globais de rótula de fibras do AstraStruct v0.16 passaram.');",1)
p.write_text(s)
