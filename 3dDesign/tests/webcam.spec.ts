import {test,expect} from '@playwright/test';

test('webcam can be inspected, resized, isolated and exported',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');
 await expect(page.locator('.provenance').filter({hasText:'Imported STEP mesh'})).toHaveCount(3,{timeout:60000});
 await page.getByRole('button',{name:'Desktop webcam',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Desktop webcam'})).toBeVisible();
 await expect(page.getByLabel('Width',{exact:true})).toHaveValue('60');
 await page.getByLabel('Width',{exact:true}).fill('64');
 await page.getByRole('button',{name:'Undo',exact:true}).click();
 await expect(page.getByLabel('Width',{exact:true})).toHaveValue('60');
 await page.screenshot({path:info.outputPath('webcam-assembled.png')});
 await page.getByRole('button',{name:'Isolate',exact:true}).click();
 await expect(page.getByText('ISOLATED COMPONENT')).toBeVisible();
 await page.getByRole('button',{name:'Export',exact:true}).click();
 const downloaded=page.waitForEvent('download');
 await page.getByRole('button',{name:/Selected part GLB/}).click();
 const file=await downloaded;expect(file.suggestedFilename()).toBe('aura-webcam.glb');
 await file.saveAs(info.outputPath('aura-webcam.glb'));
 expect(errors).toEqual([]);
});
