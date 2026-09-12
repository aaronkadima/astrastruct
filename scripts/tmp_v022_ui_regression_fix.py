from pathlib import Path
p=Path('app/src/NonlinearReportPanel.tsx')
s=p.read_text()
old='Escopo material monotônico: rótulas concentradas de fibras de aço com envelope bilinear, encruamento positivo e equilíbrio local N–M; sem memória cíclica.'
new='Escopo material monotônico: rótulas concentradas de fibras de aço com envelope bilinear, encruamento positivo e equilíbrio local N–M; sem memória cíclica. A plasticidade distribuída permanece um modelo separado, disponível nos elementos compatíveis.'
if new not in s:
    if old not in s: raise SystemExit('material limitation regression anchor missing')
    s=s.replace(old,new)
p.write_text(s)
