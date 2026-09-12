from pathlib import Path
p=Path('app/src/styles.css')
s=p.read_text()
old='.spatial3d-options{position:absolute;right:10px;top:10px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end;max-width:min(630px,62%);'
new='.spatial3d-options{position:absolute;right:10px;top:58px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end;max-width:min(700px,calc(100% - 20px));'
if old not in s:
    raise SystemExit('Canvas 3D options style anchor not found')
s=s.replace(old,new,1)
# Keep mobile controls below the two-row toolbar, with enough separation for touch targets.
s=s.replace('@media(max-width:760px){.spatial3d-toolbar{left:6px;top:6px;max-width:72%}', '@media(max-width:760px){.spatial3d-toolbar{left:6px;top:6px;max-width:calc(100% - 12px)}',1)
s=s.replace('.spatial3d-options{right:6px;top:82px;max-width:94%;max-height:86px;', '.spatial3d-options{right:6px;left:6px;top:92px;max-width:none;max-height:86px;',1)
p.write_text(s)
print('v0.26.1 Canvas 3D overlay layout fixed')
