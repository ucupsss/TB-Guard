import {useEffect,useRef,useState} from 'react';
import type {ViewMode} from './DeviceViewer';
export const animationPresets=['Separation & reassembly','Product rotation','Assembly & wiring tour','Audio direction demo'] as const;
export function useAnimation(){
 const [preset,setPreset]=useState<string>(animationPresets[0]),[playing,setPlaying]=useState(false),[active,setActive]=useState(false),[time,setTime]=useState(0);const timeRef=useRef(0);const duration=preset==='Assembly & wiring tour'?24:12;
 useEffect(()=>{if(!playing)return;let id=0,previous=performance.now();const tick=(now:number)=>{const dt=(now-previous)/1000;previous=now;timeRef.current+=dt;if(timeRef.current>=duration){timeRef.current=duration;setPlaying(false);}else id=requestAnimationFrame(tick);setTime(timeRef.current)};id=requestAnimationFrame(tick);return()=>cancelAnimationFrame(id)},[playing,duration]);
 const seek=(t:number)=>{timeRef.current=t;setTime(t);setActive(true)};
 const start=(name=preset)=>{setPreset(name);timeRef.current=0;setTime(0);setActive(true);setPlaying(true)};
 let mode:ViewMode='Assembled',explode=0,coverage=false,wiring=false,title='Product overview',direction='CENTER';
 if(preset===animationPresets[0]){mode='Exploded';explode=(1-Math.cos(time/duration*Math.PI*2))*0.6;title=time<duration/2?'Separating components':'Reassembling device';}
 if(preset===animationPresets[2]){if(time<5)title='01 / Enclosure & acoustic inlets';else if(time<10){mode='Cutaway';title='02 / Internal layout · rear-mounted buttons'}else if(time<16){mode='Exploded';explode=Math.min(1.2,(time-10)/2);title='03 / Separate parts & mounting structure'}else if(time<21){mode='Internal';wiring=true;coverage=true;title='04 / Complete conceptual wiring · not validated'}else title='05 / Ready for dimensional verification';}
 if(preset===animationPresets[3]){coverage=true;title='Audio direction demonstration · simulated';direction=['LEFT','CENTER','RIGHT'][Math.min(2,Math.floor(time/4))];}
 return {preset,setPreset:(s:string)=>{setPreset(s);seek(0);setPlaying(false)},playing,active,time,duration,mode,explode,coverage,wiring,title,direction,rotate:preset!=='Separation & reassembly',start,seek,toggle:()=>{if(time>=duration)seek(0);setActive(true);setPlaying(!playing)},stop:()=>{setActive(false);setPlaying(false)}};
}
export async function recordAnimation(source:HTMLCanvasElement,duration:number,onStart:()=>void,label:()=>string):Promise<Blob>{
 if(!source.captureStream||typeof MediaRecorder==='undefined')throw Error('Video recording is not supported in this browser.');
 const output=document.createElement('canvas');output.width=1280;output.height=720;const ctx=output.getContext('2d')!;
 const type=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));if(!type)throw Error('WebM recording unavailable.');
 const stream=output.captureStream(24),recorder=new MediaRecorder(stream,{mimeType:type,videoBitsPerSecond:4500000}),chunks:BlobPart[]=[];
 return new Promise((resolve,reject)=>{const paint=()=>{ctx.fillStyle='#f1f5f8';ctx.fillRect(0,0,1280,720);const scale=Math.min(1280/source.width,630/source.height),w=source.width*scale,h=source.height*scale;ctx.drawImage(source,(1280-w)/2,35,w,h);ctx.fillStyle='#1c3faa';ctx.fillRect(0,0,1280,48);ctx.fillRect(0,665,1280,55);ctx.fillStyle='#ffffff';ctx.font='600 21px Poppins';ctx.fillText('TB Guard  /  ACOUSTIC DEVICE STUDIO',28,31);ctx.font='16px Poppins';ctx.fillText(label(),28,696);ctx.fillStyle='#dbeafe';ctx.font='12px Poppins';ctx.fillText('ENGINEERING VISUALIZATION · PROVISIONAL DESIGN',850,29);};const interval=setInterval(paint,1000/24);let timeout:ReturnType<typeof setTimeout>;const cleanup=()=>{clearInterval(interval);clearTimeout(timeout);stream.getTracks().forEach(t=>t.stop())};recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};recorder.onerror=()=>{cleanup();reject(Error('Video recorder failed.'))};recorder.onstop=()=>{cleanup();resolve(new Blob(chunks,{type:'video/webm'}))};paint();recorder.start(500);onStart();timeout=setTimeout(()=>recorder.stop(),duration*1000+500);});
}
