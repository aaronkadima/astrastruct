import {expect,test} from '@playwright/test';

const stateKeys=async(page:any)=>page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('astrastruct.ifc.v045:')));
const readState=async(page:any,key:string)=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'null'),key);

test('IFC4X3 exchange panel exports with persistent identities',async({page})=>{
  await page.goto('./');
  const trigger=page.getByRole('button',{name:'Intercâmbio IFC'});await expect(trigger).toBeVisible();await trigger.click();
  const panel=page.getByTestId('ifc-exchange-panel');await expect(panel).toBeVisible();await expect(page.getByTestId('ifc-readiness')).toHaveText('READY');
  const exportButton=page.getByTestId('ifc-export-button');await expect(exportButton).toBeDisabled();
  await panel.getByLabel('Identificação da pessoa').fill('e2e-user');
  await panel.getByLabel('Organização *').fill('AstraStruct E2E');
  await expect(exportButton).toBeEnabled();
  const firstDownload=page.waitForEvent('download');await exportButton.click();const first=await firstDownload;expect(first.suggestedFilename()).toMatch(/\.ifc$/i);
  await expect(panel.getByRole('status')).toContainText('IFC4X3 gerado');
  const keys=await stateKeys(page);expect(keys).toHaveLength(1);const firstState=await readState(page,keys[0]);
  expect(firstState.contract).toBe('ifc-exchange-state/v1');expect(Object.keys(firstState.ids).length).toBeGreaterThan(0);
  const secondDownload=page.waitForEvent('download');await exportButton.click();await secondDownload;const secondState=await readState(page,keys[0]);
  expect(secondState.ids).toEqual(firstState.ids);expect(secondState.declarationGlobalId).toBe(firstState.declarationGlobalId);expect(secondState.groupGlobalId).toBe(firstState.groupGlobalId);expect(secondState.materialAssociationGlobalIds).toEqual(firstState.materialAssociationGlobalIds);expect(secondState.creationDate).toBe(firstState.creationDate);
});

test('IFC panel explains that file inspection does not overwrite the project',async({page})=>{
  await page.goto('./');await page.getByRole('button',{name:'Intercâmbio IFC'}).click();const panel=page.getByTestId('ifc-exchange-panel');await expect(panel).toBeVisible();
  await expect(panel.getByText(/não sobrescreve o modelo atual/i)).toBeVisible();await expect(panel.getByRole('button',{name:'Validar arquivo IFC'})).toBeVisible();
});
