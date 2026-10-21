import {completeWiring} from './wiring';
export type Vec3 = [number,number,number];
export type Part = {id:string; label:string; group:string; kind:string; size:Vec3; position:Vec3; rotation:Vec3; visible:boolean; locked:boolean; source:'CAD'|'Estimated'; purpose:string; mount:string; note:string};
export type Wire = {id:string;from:string;to:string;signal:string;pin:string;enabled:boolean};
export type Project = {version:1;parts:Part[];battery:'LiPo'|'18650';wall:number;clearance:number;spacing:number;angle:number;buttonCount:number;wires:Wire[];oled:string;direction:string};
const part=(id:string,label:string,group:string,kind:string,size:Vec3,position:Vec3,purpose:string,mount:string,note='',source:Part['source']='Estimated'):Part=>({id,label,group,kind,size,position,rotation:(kind==='carrier'||kind==='esp')?[0,0,90]:[0,0,0],visible:true,locked:false,source,purpose,mount,note});
export const initialProject=():Project=>({version:1,battery:'LiPo',wall:2.4,clearance:0.4,spacing:36,angle:0,buttonCount:2,oled:'System ready',direction:'CENTER',parts:[
 part('front','Front shell','Enclosure','front',[112,138,42],[0,0,0],'Printed enclosure with display, microphone and button apertures','Four M2.5 pilot bosses','Provisional FDM geometry. Port alignment must be checked against physical boards.'),
 part('rear','Rear cover','Enclosure','rear',[112,138,2.4],[0,0,-21],'Removable service cover','Four corner screws','Pilot holes require print calibration and chosen fastener dimensions.'),
 part('frame','Mounting frame','Enclosure','frame',[100,120,3],[0,0,-21],'Insulated mounting rails, board supports and battery tray','Rear-cover screw locations','Bracket and wire routing dimensions are provisional.'),
 ...['Left','Center','Right'].map((side,i)=>part('mic'+i,'INMP441 · '+side,'Audio subsystem','mic',[13.765734,14.24,11.25],[(i-1)*36,52,14],'Digital I2S audio capture','Dedicated insulating bracket behind front acoustic aperture','Imported PCB geometry; acoustic inlet registration requires physical verification. Three outputs need validated routing.','CAD')),
 part('carrier','Imported carrier board','Processing subsystem','carrier',[27.94,57.15,12.861],[-15.935,0,-1],'Carrier geometry included in supplied STEP','Two insulated edge rails','Actual CAD carrier; circuit identity, regulator and USB routing unverified. Module geometrically separated.','CAD'),
 part('esp','ESP32-S3-WROOM-1','Processing subsystem','esp',[18,25.5,3.1],[-38,0,3.7295],'Local audio processing and wireless connectivity','Soldered onto separate carrier','Antenna volume is a proposed keepout; validate orientation and RF layout with Espressif guidance.','CAD'),
 part('oled','OLED · 0.96-inch','User interface','oled',[27,27,4],[0,9,17],'Simulated monochrome status display','Bezel and two retaining clips','PCB 27 × 27 mm estimate. Confirm active area and mounting holes.'),
 part('button0','Power / confirm','User interface','button',[8,8,6],[-12,-27,-24],'Power, wake or confirm','Rear cap and insulated switch support','Travel and switch footprint require supplier confirmation.'),
 part('button1','Mode / mute','User interface','button',[8,8,6],[12,-27,-24],'Mode selection or mute','Rear cap and insulated switch support'),
 part('button2','Auxiliary button','User interface','button',[8,8,6],[32,-27,-24],'Configurable input','Rear cap and insulated switch support'),
 part('buzzer','Piezo buzzer','User interface','buzzer',[12,12,8],[-39,-35,-13],'Audible notifications','Rear sound outlet and mounting seat','Mute acquisition while sounding; measure feedback and structural coupling.'),
 part('battery','LiPo battery','Power subsystem','battery',[62,30,8],[0,-49,-14],'Rechargeable energy storage','Rounded tray with service access','Estimated pouch. No compression; verify insulation, protection, charge current and temperature limits.'),
 part('charger','Charging module','Power subsystem','charger',[18,24,4],[37,-55,-5],'Conceptual charger / protection arrangement','Insulated rail; connector at lower edge','TP4056 board variant unselected. Protection, load sharing and USB connector remain unverified.')
 ,part('regulator','3.3 V regulator','Power subsystem','regulator',[12,17,4],[34,27,-6],'Regulated rail for MCU and peripherals','Insulated mounting pads','Provisional regulator; peak current, dropout and thermal design unverified.'),
 part('protection','Battery protection','Power subsystem','protection',[10,18,3],[34,-12,-6],'Separate cell protection concept','Insulated mounting pads','Do not duplicate protection if selected charger/cell already integrates it; verify exact architecture.'),
 part('driver','Buzzer driver','User interface','driver',[10,10,3],[22,-25,0],'GPIO-controlled switching stage','Insulated mounting pads','Choose transistor, bias resistors and flyback protection for actual buzzer.'),
 part('sense','Battery sense divider','Power subsystem','sense',[10,8,2],[29,13,0],'Safe battery voltage measurement','Insulated mounting pads','Resistor ratio, RC filter and ADC limits must be calculated before wiring.')
 ],wires:completeWiring()});

export function activeParts(p:Project){return p.parts.filter(x=>!x.id.startsWith('button')||Number(x.id.slice(-1))<p.buttonCount);}
export function enclosure(p:Project):Vec3{
 const ext=[52,65,18];
 for(const a of activeParts(p).filter(a=>!['front','rear','frame'].includes(a.kind))){
  // A rotated box's world-space extents (XYZ Euler); keeps resized parts inside the shell envelope.
  const r=a.rotation.map(v=>v*Math.PI/180),[sx,sy,sz]=r.map(Math.sin),[cx,cy,cz]=r.map(Math.cos);
  const m=[[cy*cz,-cy*sz,sy],[sx*sy*cz+cx*sz,-sx*sy*sz+cx*cz,-sx*cy],[-cx*sy*cz+sx*sz,cx*sy*sz+sx*cz,cx*cy]];
  for(let i=0;i<3;i++){if(i===2&&a.kind==='button')continue;ext[i]=Math.max(ext[i],Math.abs(a.position[i])+m[i].reduce((s,v,j)=>s+Math.abs(v)*a.size[j]/2,0));}
 }
 return ext.map(v=>Math.ceil((v+p.wall+p.clearance+2.5)*2)) as Vec3;
}
export function issues(p:Project):string[]{
 const result=['Provisional mounts, OLED and power components need measurement.','Audio synchronization, channel selection and GPIO routing are unverified.','Charger protection, load sharing and regulation are unverified.','Antenna keepout and acoustic port registration need physical validation.'];
 const audio=p.wires.filter(w=>w.enabled&&w.from.startsWith('mic')&&w.signal.startsWith('SD'));
 for(const a of p.parts.filter(a=>a.kind==='mic')){const port=acousticPath(p,a);if(!port.valid)result.push(a.label+': inlet faces away from the front; reset rotation.');if(Math.abs(port.entry[0])>enclosure(p)[0]/2-5||Math.abs(port.entry[1])>enclosure(p)[1]/2-5)result.push(a.label+': acoustic opening reaches the shell edge.');}
 if(new Set(audio.map(w=>w.pin.trim().toUpperCase())).size<2&&audio.length>2)result.push('Electrical conflict: three microphones assigned to one data route.');
 const list=activeParts(p).filter(a=>!['front','rear','frame'].includes(a.kind));
 for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
  const a=list[i],b=list[j];
  if([a.id,b.id].includes('esp')&&[a.id,b.id].includes('carrier'))continue;
  const sa=rotatedSize(a),sb=rotatedSize(b);
  if(a.position.every((v,k)=>Math.abs(v-b.position[k])<(sa[k]+sb[k])/2-0.05))result.push('Bounding-box overlap: '+a.label+' / '+b.label);
 }
 return result;
}
export function acousticPath(p:Project,a:Part){
 const [rx,ry]=a.rotation.map(v=>v*Math.PI/180),direction:Vec3=[Math.sin(ry),-Math.sin(rx)*Math.cos(ry),Math.cos(rx)*Math.cos(ry)];
 const inlet=a.position.map((v,i)=>v-direction[i]*2.025*a.size[2]/11.25) as Vec3;
 const distance=(enclosure(p)[2]/2-inlet[2])/Math.max(0.15,direction[2]);
 const entry=inlet.map((v,i)=>v+direction[i]*distance) as Vec3;
 return {inlet,entry,direction,valid:direction[2]>0.15&&distance>0};
}
export function validateProject(v:unknown):v is Project{
 if(!v||typeof v!=='object')return false;
 const p=v as Project,base=initialProject();
 const vec=(a:unknown)=>Array.isArray(a)&&a.length===3&&a.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=1000);
 return p.version===1&&['LiPo','18650'].includes(p.battery)&&Number.isFinite(p.wall)&&p.wall>=1&&p.wall<=5&&Number.isFinite(p.clearance)&&p.clearance>=0.1&&p.clearance<=2&&Number.isFinite(p.spacing)&&p.spacing>=22&&p.spacing<=55&&Number.isFinite(p.angle)&&Math.abs(p.angle)<=60&&[1,2,3].includes(p.buttonCount)&&typeof p.oled==='string'&&typeof p.direction==='string'&&Array.isArray(p.parts)&&p.parts.length===base.parts.length&&new Set(p.parts.map(a=>a.id)).size===base.parts.length&&p.parts.every(a=>{const original=base.parts.find(b=>b.id===a.id);return original&&original.kind===a.kind&&vec(a.position)&&vec(a.rotation)&&vec(a.size)&&a.size.every(n=>n>0)&&typeof a.label==='string'&&typeof a.visible==='boolean'&&typeof a.locked==='boolean';})&&Array.isArray(p.wires)&&p.wires.length<100&&p.wires.every(w=>typeof w.id==='string'&&typeof w.signal==='string'&&typeof w.pin==='string'&&typeof w.enabled==='boolean'&&p.parts.some(a=>a.id===w.from)&&p.parts.some(a=>a.id===w.to));
}

export function rotatedSize(a:Part):Vec3{const r=a.rotation.map(v=>v*Math.PI/180),[sx,sy,sz]=r.map(Math.sin),[cx,cy,cz]=r.map(Math.cos);const m=[[cy*cz,-cy*sz,sy],[sx*sy*cz+cx*sz,-sx*sy*sz+cx*cz,-sx*cy],[-cx*sy*cz+sx*sz,cx*sy*sz+sx*cz,cx*cy]];return m.map(row=>row.reduce((s,v,j)=>s+Math.abs(v)*a.size[j],0)) as Vec3;}
export function fitInterfaces(p:Project):Project{const d=enclosure(p)[2];return {...p,parts:p.parts.map(a=>a.kind==='button'?{...a,position:[a.position[0],a.position[1],-d/2+1]}:a)};}
