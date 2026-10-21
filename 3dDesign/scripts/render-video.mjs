import {chromium} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-webgl','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
 await page.goto('http://127.0.0.1:5173');
 await page.locator('.provenance').filter({hasText:'Imported STEP mesh'}).last().waitFor({timeout:60000});
 await page.waitForFunction(()=>document.querySelectorAll('.provenance').length===3&&[...document.querySelectorAll('.provenance')].every(n=>n.textContent.includes('Imported STEP mesh')));
 await page.waitForTimeout(1000);
 const download=page.waitForEvent('download',{timeout:90000});
 await page.getByRole('button',{name:'Record WebM',exact:true}).click();
 const video=await download;
 fs.mkdirSync('public/videos',{recursive:true});
 const file=path.resolve('public/videos/aura-assembly.webm');await video.saveAs(file);
 console.log('Recorded WebM:',fs.statSync(file).size,'bytes');
 const converted=spawnSync('ffmpeg',['-y','-i',file,'-c:v','libx264','-preset','medium','-crf','22','-pix_fmt','yuv420p','-movflags','+faststart',path.resolve('public/videos/aura-assembly.mp4')],{encoding:'utf8',windowsHide:true});
 if(converted.status!==0)throw Error(converted.stderr||converted.error?.message||'ffmpeg failed');
 console.log('MP4:',fs.statSync('public/videos/aura-assembly.mp4').size,'bytes');
 await page.getByRole('button',{name:'Play video',exact:true}).click();
 await page.waitForFunction(()=>{const v=document.querySelector('video');return v&&v.readyState>=2&&v.videoWidth===1280&&v.duration>20});
 await page.waitForTimeout(1000);
 console.log('Playback verified:',await page.locator('video').evaluate(v=>({width:v.videoWidth,height:v.videoHeight,duration:v.duration,currentTime:v.currentTime,error:v.error})));
 await page.screenshot({path:'public/videos/playback-preview.png'});
}finally{await browser.close();}
