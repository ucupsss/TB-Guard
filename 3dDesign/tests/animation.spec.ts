import {test,expect} from '@playwright/test';
test('rear controls, separation, playback presets and microphone orientation audit',async({page},info)=>{
 await page.goto('/');await expect(page.locator('.provenance').filter({hasText:'Imported STEP mesh'})).toHaveCount(3,{timeout:60000});
 await page.getByRole('button',{name:'Separate parts',exact:true}).click();await expect(page.getByLabel('Separation')).toBeVisible();
 await page.getByRole('button',{name:'Reassemble',exact:true}).click();await expect(page.getByLabel('Separation')).toHaveCount(0);
 await page.getByLabel('Camera view').selectOption('Rear');await page.waitForTimeout(700);await page.screenshot({path:info.outputPath('rear-buttons.png')});
 await page.getByRole('button',{name:'Power / confirm',exact:true}).click();await expect(page.getByLabel('Z position',{exact:true})).toHaveValue('-24');
 await page.getByRole('button',{name:'Play animation',exact:true}).click();await page.waitForTimeout(800);await page.getByRole('button',{name:'Pause animation',exact:true}).click();const t=await page.getByLabel('Animation timeline').inputValue();expect(Number(t)).toBeGreaterThan(0);await page.waitForTimeout(300);await expect(page.getByLabel('Animation timeline')).toHaveValue(t);
 for(const preset of ['Product rotation','Assembly & wiring tour','Audio direction demo']){await page.getByLabel('Animation preset').selectOption(preset);await page.getByLabel('Animation timeline').fill(preset==='Assembly & wiring tour'?'18':'8');}
 await page.getByRole('button',{name:'Reassemble',exact:true}).click();
 await page.getByRole('button',{name:'INMP441 · Left',exact:true}).click();await page.getByLabel('Y rotation',{exact:true}).fill('180');await page.getByRole('button',{name:'Assembly',exact:true}).click();await expect(page.getByText(/inlet faces away/)).toBeVisible();
 await page.getByRole('button',{name:'Play video',exact:true}).click();const video=page.locator('video');await expect(video).toBeVisible();await expect.poll(()=>video.evaluate(v=>(v as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2);expect(await video.evaluate(v=>(v as HTMLVideoElement).duration)).toBeGreaterThan(20);
});
