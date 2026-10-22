// Render offline video halus: tiap frame dirender deterministik pada waktu animasi tertentu (bukan rekam real-time),
// lalu digabung dengan ffmpeg. Jalankan dengan `npx vite --host 127.0.0.1 --port 5173` aktif:
//   node scripts/render-frames.mjs [fps=60]
import {chromium} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const FPS=Number(process.argv[2]||60);
const dir=path.resolve('.tmp-frames');fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-webgl','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
 await page.goto('http://127.0.0.1:5173/?render=1');
 await page.waitForFunction(()=>document.querySelectorAll('.provenance').length===3&&[...document.querySelectorAll('.provenance')].every(n=>n.textContent.includes('Imported STEP mesh')),null,{timeout:90000});
 await page.waitForFunction(()=>window.__aura&&window.__aura.duration>0);
 await page.waitForTimeout(1500);
 const duration=await page.evaluate(()=>window.__aura.duration);
 const total=Math.round(duration*FPS);
 console.log('duration',duration,'frames',total,'fps',FPS);
 for(let i=0;i<=total;i++){
  const t=Math.min(duration,i/FPS);
  const b64=await page.evaluate(async(t)=>{
   window.__aura.seek(t);
   await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const src=document.querySelector('canvas');const out=document.createElement('canvas');out.width=1280;out.height=720;const c=out.getContext('2d');
   c.fillStyle='#172023';c.fillRect(0,0,1280,720);
   const scale=Math.min(1280/src.width,630/src.height),w=src.width*scale,h=src.height*scale;c.drawImage(src,(1280-w)/2,35,w,h);
   c.fillStyle='#13201c';c.fillRect(0,0,1280,48);c.fillRect(0,665,1280,55);
   c.fillStyle='#b9ead4';c.font='600 21px monospace';c.fillText('AURA  /  ACOUSTIC DEVICE STUDIO',28,31);
   c.font='16px monospace';c.fillText(t<window.__aura.duration/2?'Separating components':'Reassembling device',28,696);
   c.fillStyle='#78988a';c.font='12px monospace';c.fillText('ENGINEERING VISUALIZATION · PROVISIONAL DESIGN',850,29);
   return out.toDataURL('image/jpeg',0.92).split(',')[1];
  },t);
  fs.writeFileSync(path.join(dir,`f${String(i).padStart(5,'0')}.jpg`),Buffer.from(b64,'base64'));
  if(i%60===0)console.log('frame',i,'/',total);
 }
 const out=path.resolve('public/videos/aura-assembly.mp4');
 const r=spawnSync('ffmpeg',['-y','-framerate',String(FPS),'-i',path.join(dir,'f%05d.jpg'),'-c:v','libx264','-preset','slow','-crf','20','-pix_fmt','yuv420p','-r',String(FPS),'-movflags','+faststart',out],{encoding:'utf8',windowsHide:true});
 if(r.status!==0)throw Error(r.stderr||'ffmpeg failed');
 console.log('MP4',fs.statSync(out).size,'bytes');
}finally{await browser.close();fs.rmSync(dir,{recursive:true,force:true});}
