from pathlib import Path
import sys

mode = sys.argv[1] if len(sys.argv)>1 else 'pre'

def replace(path, old, new, required=True):
    p=Path(path); s=p.read_text()
    if old not in s:
        if required: raise SystemExit(f'anchor not found in {path}: {old[:160]!r}')
        return
    p.write_text(s.replace(old,new,1))

if mode=='pre':
    # The original validated v0.27 patch was authored on v0.26.0. Normalize only
    # its version/text anchors so the same integration can be exercised on the
    # published v0.26.1 Canvas 3D baseline.
    replace('web/src/core/version.js', "export const PRODUCT_VERSION = '0.26.1';", "export const PRODUCT_VERSION = '0.26.0';")
    replace('package.json', '"version": "0.26.1"', '"version": "0.26.0"')
    replace('app/src/App.tsx', '<strong>AstraStruct</strong><small>v0.26.1 · Canvas 3D</small>', '<strong>AstraStruct</strong><small>v0.25.1 · schema/migration core</small>')
    print('v0.27 Canvas bridge pre-normalization applied')
elif mode=='post':
    # The v0.27 modal E2E must prove the analysis is delivered by the new Canvas,
    # not only by the result table.
    p=Path('tests/e2e/modal3d-v027.spec.ts'); s=p.read_text()
    needle="await expect(r).toContainText('ΣMef,Z');"
    addition="await expect(r).toContainText('ΣMef,Z');const canvas=page.getByTestId('spatial-canvas-3d');await expect(canvas).toBeVisible();await expect(canvas).toHaveAttribute('data-shape-kind','modal');await expect(page.getByTestId('spatial3d-result-controls')).toBeVisible();await expect(page.getByTestId('spatial3d-shape-kind')).toContainText('Modo 1');await page.getByTestId('spatial3d-animate').click();await expect(page.getByTestId('spatial3d-animate')).toContainText('Parar');"
    if needle in s: s=s.replace(needle,addition,1)
    p.write_text(s)

    # For buckling, the stability panel owns the selected mode. Avoid presenting
    # a second unsynchronized mode selector in the Canvas itself.
    p=Path('app/src/SpatialCanvas3D.tsx'); s=p.read_text()
    s=s.replace("{modeCount>1&&<label>Modo <select aria-label=\"Modo 3D\" value={modeIndex}", "{modeCount>1&&shape.kind!=='buckling'&&<label>Modo <select aria-label=\"Modo 3D\" value={modeIndex}",1)
    p.write_text(s)

    # Add an E2E for spatial buckling + Canvas visualization. It creates a
    # pin-ended column with multiple frame elements and a compressive reference load.
    Path('tests/e2e/buckling3d-v027.spec.ts').write_text(r'''import {test,expect} from '@playwright/test';

test('v0.27 visualizes a 3D linear buckling mode in Canvas 3D',async({page})=>{
 const n=6,L=4,E=200e6,A=.01,Iy=6e-5,Iz=9e-5,J=2e-5;
 const nodes=Array.from({length:n+1},(_,i)=>({id:`N${i}`,x:L*i/n,y:0,z:0}));
 const elements=Array.from({length:n},(_,i)=>({id:`E${i}`,type:'frame3d',n1:`N${i}`,n2:`N${i+1}`,materialId:'S',sectionId:'SEC',A,Iy,Iz,J,orientation:{up:[0,1,0]}}));
 const p={id:'buckling3d',name:'Buckling 3D',version:13,schemaVersion:2,units:'kN-m-MPa',nodes,elements,materials:[{id:'S',type:'steel',E,nu:.3,density:78.5}],sections:[{id:'SEC',family:'steel3d',A,Iy,Iz,J,I:Iz}],supports:[{nodeId:'N0',ux:true,uy:true,uz:true,rx:true},{nodeId:`N${n}`,uy:true,uz:true}],loads:[{id:'P',caseId:'LC1',nodeId:`N${n}`,fx:-1000}],elementLoads:[],settlements:[],nodeSprings:[],nodalMasses:[],loadCases:[{id:'LC1',name:'Compressão'}],loadCombinations:[],connections:[],settings:{analysisType:'linear',analysisScenarioId:'LC1',activeLoadCaseId:'LC1',grid:.25,snap:true},meta:{}};
 await page.addInitScript(x=>localStorage.setItem('astrastruct.project',JSON.stringify(x)),p);await page.goto('./');
 await page.getByLabel('Estabilidade').click();await expect(page.getByTestId('panel-buckling')).toBeVisible();await page.getByTestId('buckling-calculate').click();await expect(page.getByTestId('buckling-critical-factor')).toBeVisible();
 const factor=Number(await page.getByTestId('buckling-critical-factor').textContent());expect(factor).toBeGreaterThan(0);const canvas=page.getByTestId('spatial-canvas-3d');await expect(canvas).toHaveAttribute('data-shape-kind','buckling');await expect(page.getByTestId('spatial3d-shape-kind')).toContainText('Flambagem');await page.getByTestId('spatial3d-animate').click();await expect(page.getByTestId('spatial3d-animate')).toContainText('Parar');
});
''')
    print('v0.27 Canvas bridge post-integration applied')
else:
    raise SystemExit('usage: tmp_v027_canvas_bridge.py pre|post')
