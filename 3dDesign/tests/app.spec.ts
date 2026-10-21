import {test,expect} from '@playwright/test';
import fs from 'node:fs';
test('complete engineering workflow and downloadable outputs',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.getByRole('heading',{name:'Device assembly'})).toBeVisible();
 await expect(page.locator('.provenance').filter({hasText:'Imported STEP mesh'})).toHaveCount(3,{timeout:60000});
 await page.waitForTimeout(1500);await page.screenshot({path:info.outputPath('assembled.png'),fullPage:true});
 const canvas=page.locator('canvas');await expect(canvas).toBeVisible();
 await page.getByRole('button',{name:'Internal',exact:true}).click();
 await page.getByRole('button',{name:'INMP441 · Left',exact:true}).click();await expect(page.getByRole('heading',{name:'INMP441 · Left'})).toBeVisible();
 const x=page.getByRole('spinbutton',{name:'X position',exact:true});await x.fill('-42');await expect(x).toHaveValue('-42');
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(x).toHaveValue('-36');await page.getByRole('button',{name:'Redo',exact:true}).click();await expect(x).toHaveValue('-42');
 await page.getByRole('button',{name:'Lock selected component'}).click();await expect(x).toBeDisabled();await page.getByRole('button',{name:'Lock selected component'}).click();
 await page.getByRole('button',{name:'Isolate',exact:true}).click();await expect(page.getByText('ISOLATED COMPONENT')).toBeVisible();await page.getByRole('button',{name:'Show all',exact:true}).click();
 await page.getByRole('button',{name:'Exploded',exact:true}).click();await page.getByLabel('Separation').fill('1.2');await page.getByRole('button',{name:'Toggle acoustic coverage'}).click();await page.getByRole('button',{name:'Toggle wiring overlay'}).click();await page.waitForTimeout(900);await page.screenshot({path:info.outputPath('exploded.png'),fullPage:true});
 for(const mode of ['Transparent','Cutaway','Assembled'])await page.getByRole('button',{name:mode,exact:true}).click();
 for(const view of ['Front','Rear','Left','Right','Top','Bottom','Isometric'])await page.getByLabel('Camera view').selectOption(view);
 await page.getByLabel('OLED state').selectOption('Cough detected');await expect(page.locator('.oled-preview')).toContainText('COUGH DETECTED');
 await page.getByRole('button',{name:'Assembly',exact:true}).click();await page.getByLabel('Battery configuration').selectOption('18650');await expect(page.locator('.metrics')).toContainText('18650');await page.getByLabel('Button count').selectOption('3');await expect(page.getByRole('button',{name:'Auxiliary button',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Wiring',exact:true}).click();for(const id of ['audio0','audio1','audio2'])await page.getByLabel('Route '+id,{exact:true}).fill('ONE_BUS');await expect(page.getByText(/Electrical conflict: three/)).toBeVisible();
 await page.getByRole('button',{name:'Save project',exact:true}).click();await expect(page.getByRole('status')).toContainText('saved');
 await page.getByRole('button',{name:'Export',exact:true}).click();
 for(const label of ['Project JSON','Inventory CSV','Wiring SVG','CAD handoff · SCAD','Assembly GLB','Selected part GLB']){
  const d=page.waitForEvent('download');await page.getByRole('button',{name:new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))}).click();const file=await d;const loc=info.outputPath(file.suggestedFilename());await file.saveAs(loc);const buf=fs.readFileSync(loc);expect(buf.length).toBeGreaterThan(100);if(loc.endsWith('.glb')){expect(buf.subarray(0,4).toString()).toBe('glTF');expect(buf.readUInt32LE(8)).toBe(buf.length)}
 }
 const json=info.outputPath('aura-project.json');await page.locator('input[type=file]').setInputFiles(json);await expect(page.getByRole('status')).toContainText('imported');await page.getByRole('button',{name:'Close export'}).click();
 await page.setViewportSize({width:390,height:844});await expect(page.getByRole('heading',{name:'Device assembly'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('mobile.png'),fullPage:true});expect(errors).toEqual([]);
});
