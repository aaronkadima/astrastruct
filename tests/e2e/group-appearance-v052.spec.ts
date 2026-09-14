import{test,expect}from'@playwright/test';

test('v0.52 Canvas settings applies node visibility/transparency and appearance by structural group',async({page})=>{
  await page.goto('./');
  await page.keyboard.press('Control+,');
  const dialog=page.getByTestId('workspace-settings-dialog');await expect(dialog).toBeVisible();
  const panel=dialog.locator('[data-group-appearance]');await expect(panel).toBeVisible();
  const nodes=panel.locator('[data-node-appearance]');await expect(nodes).toBeVisible();await expect(nodes).toContainText('Nós');
  const nodeOpacity=nodes.locator('input[data-node-field="opacity"]'),nodeVisible=nodes.locator('input[data-node-field="visible"]');
  await nodeOpacity.evaluate((el:any)=>{el.value='0.35';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});
  await expect(nodes.locator('[data-node-pct]')).toHaveText('35%');
  await nodeVisible.uncheck();
  await expect.poll(async()=>page.evaluate(()=>{try{const p=JSON.parse(localStorage.getItem('astrastruct.project')||'{}');return[p.visualization?.nodeAppearance?.contract,p.visualization?.nodeAppearance?.opacity,p.visualization?.nodeAppearance?.visible]}catch{return[]}})).toEqual(['node-appearance/v1',.35,false]);
  for(const id of['slab','beam','column','wall','brace','foundation','other'])await expect(panel.locator(`[data-appearance-group="${id}"]`)).toBeVisible();
  const beam=panel.locator('[data-appearance-group="beam"]'),color=beam.locator('input[data-group-field="color"]'),opacity=beam.locator('input[data-group-field="opacity"]');
  await color.fill('#8844cc');
  await opacity.evaluate((el:any)=>{el.value='0.45';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});
  await expect.poll(async()=>page.evaluate(()=>{try{const p=JSON.parse(localStorage.getItem('astrastruct.project')||'{}');return[p.visualization?.groupAppearance?.beam?.color,p.visualization?.groupAppearance?.beam?.opacity]}catch{return[]}})).toEqual(['#8844cc',.45]);
  await expect(beam.locator('[data-group-pct]')).toHaveText('45%');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('astrastruct.project')||'{}'));const beamMembers=Object.values(saved.visualization?.elementAppearance||{}).filter((x:any)=>x?.derivedFromGroup==='beam');for(const style of beamMembers as any[]){expect(style.color).toBe('#8844cc');expect(style.opacity).toBe(.45);}
  await nodeVisible.check();
  await dialog.getByRole('button',{name:'Concluir',exact:true}).click();await expect(dialog).toBeHidden();
});
