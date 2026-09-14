import {expect,test} from '@playwright/test';
import {readFile} from 'node:fs/promises';

const stateKeys=async(page:any)=>page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('astrastruct.ifc.v045:')));
const readState=async(page:any,key:string)=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'null'),key);
const openIfc=async(page:any)=>{await page.goto('./');await expect(page.getByTestId('astra-app')).toBeVisible();const trigger=page.getByRole('button',{name:'Intercâmbio IFC'});await expect(trigger).toBeVisible();await trigger.click();const panel=page.getByTestId('ifc-exchange-panel');await expect(panel).toBeVisible();return panel};
const authorizeExport=async(panel:any)=>{await panel.getByLabel('Identificação da pessoa').fill('e2e-user');await panel.getByLabel('Organização *').fill('AstraStruct E2E')};

async function exportIfc(page:any,panel:any){
  await authorizeExport(panel);const button=page.getByTestId('ifc-export-button');await expect(button).toBeEnabled();const pending=page.waitForEvent('download');await button.click();const download=await pending;expect(download.suggestedFilename()).toMatch(/\.ifc$/i);const path=await download.path();if(!path)throw new Error('Playwright não forneceu caminho do download IFC.');return path;
}

test('IFC4X3 exchange panel exports with persistent identities',async({page})=>{
  const panel=await openIfc(page);await expect(page.getByTestId('ifc-readiness')).toHaveText('READY');
  const exportButton=page.getByTestId('ifc-export-button');await expect(exportButton).toBeDisabled();await authorizeExport(panel);await expect(exportButton).toBeEnabled();
  const firstDownload=page.waitForEvent('download');await exportButton.click();const first=await firstDownload;expect(first.suggestedFilename()).toMatch(/\.ifc$/i);
  await expect(panel.getByRole('status')).toContainText('IFC4X3 gerado');
  const keys=await stateKeys(page);expect(keys).toHaveLength(1);const firstState=await readState(page,keys[0]);
  expect(firstState.contract).toBe('ifc-exchange-state/v1');expect(Object.keys(firstState.ids).length).toBeGreaterThan(0);
  const secondDownload=page.waitForEvent('download');await exportButton.click();await secondDownload;const secondState=await readState(page,keys[0]);
  expect(secondState.ids).toEqual(firstState.ids);expect(secondState.declarationGlobalId).toBe(firstState.declarationGlobalId);expect(secondState.groupGlobalId).toBe(firstState.groupGlobalId);expect(secondState.materialAssociationGlobalIds).toEqual(firstState.materialAssociationGlobalIds);expect(secondState.creationDate).toBe(firstState.creationDate);
});

test('IFC staged import validates before replacement and creates a local backup',async({page})=>{
  const panel=await openIfc(page);const original=await page.evaluate(()=>JSON.parse(localStorage.getItem('astrastruct.project')||'null'));const path=await exportIfc(page,panel);
  const input=panel.locator('input[type=file]');await input.setInputFiles(path);
  const preview=page.getByTestId('ifc-preview');await expect(preview).toBeVisible();await expect(preview).toContainText('Geometria READY');await expect(preview).toContainText('Análise READY');
  const importButton=page.getByTestId('ifc-import-button');await expect(importButton).toBeEnabled();await expect(importButton).toHaveText('Importar projeto IFC');
  await importButton.click();await page.waitForLoadState('domcontentloaded');await expect(page.getByTestId('astra-app')).toBeVisible();
  const persisted=await page.evaluate(()=>({project:JSON.parse(localStorage.getItem('astrastruct.project')||'null'),backup:JSON.parse(localStorage.getItem('astrastruct.ifc.import.backup.v046')||'null')}));
  expect(persisted.backup?.project?.id).toBe(original.id);expect(persisted.backup?.sourceProjectId).toBe(original.id);expect(persisted.project?.meta?.importedFrom?.format).toBe('IFC');expect(persisted.project?.meta?.analysisReady).toBe(true);
});

test('IFC without mechanical properties remains geometry-only until completed',async({page})=>{
  const panel=await openIfc(page);const path=await exportIfc(page,panel),source=await readFile(path,'utf8');
  const withoutMechanics=source.split(/\r?\n/).filter(line=>!line.includes('IFCMATERIALPROPERTIES(')&&!line.includes('IFCPROPERTYSINGLEVALUE(')).join('\n');
  await panel.locator('input[type=file]').setInputFiles({name:'geometry-only.ifc',mimeType:'application/x-step',buffer:Buffer.from(withoutMechanics)});
  const preview=page.getByTestId('ifc-preview');await expect(preview).toBeVisible();await expect(preview).toContainText('Geometria READY');await expect(preview).toContainText('Análise PENDING');await expect(preview).toContainText('YOUNG_MODULUS_MISSING');
  const importButton=page.getByTestId('ifc-import-button');await expect(importButton).toBeEnabled();await expect(importButton).toHaveText('Importar geometria (análise pendente)');
});
