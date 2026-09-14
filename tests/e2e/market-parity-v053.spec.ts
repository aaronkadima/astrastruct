import{test,expect}from'@playwright/test';

test('v0.53 unified building design basis persists market-parity project criteria',async({page})=>{
  await page.goto('./');
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('astrastruct:market-parity-open')));
  const wb=page.getByTestId('market-parity-workbench');await expect(wb).toBeVisible();
  await wb.getByRole('button',{name:'Critérios',exact:true}).click();
  await wb.getByTestId('mp-design-code').fill('TEST USER CODE');
  await wb.getByTestId('mp-fck-beam').fill('35');
  await wb.getByTestId('mp-cover-beam').fill('40');
  await wb.getByRole('button',{name:'Ações',exact:true}).click();
  await wb.getByTestId('mp-wind-speed').fill('42');
  await wb.getByRole('button',{name:'Análise + resultados',exact:true}).click();
  await wb.getByTestId('mp-analysis-type').selectOption('pdelta');
  await wb.getByTestId('mp-save').click();
  await expect(wb).toContainText('Base do projeto salva');
  await expect.poll(async()=>page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('astrastruct.project')||'{}');return[p.designBasis?.contract,p.designBasis?.general?.designCode,p.designBasis?.durability?.concrete?.beamFckMpa,p.designBasis?.durability?.coversMm?.beam,p.designBasis?.actions?.wind?.basicSpeedMS,p.settings?.analysisType,p.designBasis?.governance?.normativeCoefficientsInferred]})).toEqual(['building-design-basis/v1','TEST USER CODE',35,40,42,'pdelta',false]);
});
