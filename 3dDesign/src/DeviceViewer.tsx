import { memo, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, RoundedBox, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import {GLTFLoader,type GLTF} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {activeParts,acousticPath,enclosure,type Part,type Project,type Vec3} from './engineering';
import {wireColor} from './wiring';
export type ViewMode='Assembled'|'Transparent'|'Cutaway'|'Exploded'|'Internal';
export type ViewerProps={project:Project;selected:string;select:(id:string)=>void;mode:ViewMode;explode:number;coverage:boolean;wiring:boolean;camera:string;cameraKey:number;isolate:string|null;onScene:(scene:THREE.Group)=>void;onAsset:(id:string,status:string)=>void;playing?:boolean};
const cadPaths:Record<string,string>={mic:'/models/microphone/inmp441.glb',esp:'/models/microcontroller/esp32-s3-wroom-1.glb',carrier:'/models/microcontroller/carrier.glb'};
const cadCache:Record<string,Promise<GLTF>>={};
function CAD({part,onAsset}:{part:Part;onAsset:ViewerProps['onAsset']}){
 const [data,setData]=useState<GLTF|null>(null);
 useEffect(()=>{let alive=true;const url=cadPaths[part.kind];cadCache[url]??=new GLTFLoader().loadAsync(url);cadCache[url].then(d=>{if(alive){setData(d);onAsset(part.kind,'Imported STEP mesh');}}).catch(()=>{if(alive)onAsset(part.kind,'Missing asset · placeholder');});return()=>{alive=false}},[part.kind,onAsset]);
 const model=useMemo(()=>{const c=data?.scene.clone(true);c?.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});return c},[data]);
 if(!model)return <Box size={part.size} color="#247867"/>;
 const natural:Vec3=part.kind==='mic'?[13.765734,14.24,11.25]:part.kind==='esp'?[18,25.5,3.1]:[27.94,57.15,12.861];
 return <group scale={part.size.map((v,i)=>1000*v/natural[i]) as Vec3}><primitive object={model} rotation={part.kind==='mic'?[-Math.PI/2,0,0]:[0,0,0]}/></group>;
}
function Box({size,position=[0,0,0],color='#dde1df',radius=0.6,opacity=1}:{size:Vec3;position?:Vec3;color?:string;radius?:number;opacity?:number}){return <RoundedBox args={size} position={position} radius={Math.min(radius,...size.map(v=>v/3))} smoothness={3} castShadow receiveShadow><meshStandardMaterial color={color} roughness={0.7} transparent={opacity<1} opacity={opacity} depthWrite={opacity===1}/></RoundedBox>}
function outline(w:number,h:number,r=8){const s=new THREE.Shape();s.moveTo(-w/2+r,-h/2);s.lineTo(w/2-r,-h/2);s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);s.lineTo(w/2,h/2-r);s.quadraticCurveTo(w/2,h/2,w/2-r,h/2);s.lineTo(-w/2+r,h/2);s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);s.lineTo(-w/2,-h/2+r);s.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);return s;}
function hole(s:THREE.Shape,x:number,y:number,w:number,h:number){const p=new THREE.Path();p.moveTo(x-w/2,y-h/2);p.lineTo(x-w/2,y+h/2);p.lineTo(x+w/2,y+h/2);p.lineTo(x+w/2,y-h/2);p.closePath();s.holes.push(p);}
function circleHole(s:THREE.Shape,x:number,y:number,r:number){const p=new THREE.Path();p.absarc(x,y,r,0,Math.PI*2,true);s.holes.push(p);}
function Plate({shape,depth,z,color='#e0e4e1',opacity=1}:{shape:THREE.Shape;depth:number;z:number;color?:string;opacity?:number}){const g=useMemo(()=>new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:24}),[shape,depth]);useEffect(()=>()=>g.dispose(),[g]);return <mesh geometry={g} position={[0,0,z]} castShadow receiveShadow><meshStandardMaterial color={color} roughness={0.68} transparent={opacity<1} opacity={opacity} side={THREE.DoubleSide} depthWrite={opacity===1}/></mesh>}
function PrintLabel({text,position,width=18,height=3,color='#526966'}:{text:string;position:Vec3;width?:number;height?:number;color?:string}){
 const texture=useMemo(()=>{const c=document.createElement('canvas');c.width=512;c.height=80;const ctx=c.getContext('2d')!;ctx.fillStyle=color;ctx.font='600 38px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,40);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t},[text,color]);useEffect(()=>()=>texture.dispose(),[texture]);return <mesh position={position}><planeGeometry args={[width,height]}/><meshBasicMaterial map={texture} transparent depthWrite={false}/></mesh>;
}
function FrontDetails({p,opacity}:{p:Project;opacity:number}){
 const z=enclosure(p)[2]/2,oled=p.parts.find(a=>a.id==='oled')!;
 const bezel=useMemo(()=>{const s=outline(oled.size[0]+3,oled.size[1]-4,2);hole(s,0,0,oled.size[0]-3,oled.size[1]-10);return s},[oled.size]);
 return <group>
 {p.parts.filter(a=>a.kind==='mic').map((a,i)=>{const {inlet,entry,valid}=acousticPath(p,a);if(!valid)return null;const end=new THREE.Vector3(...entry),start=new THREE.Vector3(...inlet),delta=end.clone().sub(start),length=delta.length();const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),delta.normalize());const ring=new THREE.Shape();ring.absarc(0,0,2.2,0,Math.PI*2,false);circleHole(ring,0,0,1.65);return <group key={a.id}><group position={inlet} quaternion={q}><Plate shape={ring} depth={length} z={0} color="#536764" opacity={opacity}/></group><mesh position={[entry[0],entry[1],z+0.1]}><torusGeometry args={[2.5,0.45,10,32]}/><meshStandardMaterial color="#405b55" roughness={0.8} transparent={opacity<1} opacity={opacity}/></mesh><PrintLabel text={'MIC '+['L','C','R'][i]} position={[entry[0],entry[1]-5,z+0.12]} width={12} height={2.2}/></group>})}
 <group position={[oled.position[0],oled.position[1],z]}><Plate shape={bezel} depth={0.6} z={0.05} color="#2d4140" opacity={opacity}/></group>
 <PrintLabel text="A U R A" position={[0,-8,z+0.12]} width={18} height={3.5}/>
 <PrintLabel text="ACOUSTIC SENSING" position={[0,-13,z+0.12]} width={24} height={2}/>
 
 </group>;
}
function Shell({p,rear,mode}:{p:Project;rear?:boolean;mode:ViewMode}){
 const [w,h,d]=enclosure(p),t=p.wall;
 const face=useMemo(()=>{const s=outline(w,h);if(!rear){const display=p.parts.find(a=>a.id==='oled')!;hole(s,display.position[0],display.position[1],display.size[0]-3,display.size[1]-10);for(const a of activeParts(p)){if(a.kind==='mic'){const port=acousticPath(p,a);if(port.valid)circleHole(s,port.entry[0],port.entry[1],2.2);}}}else{for(const a of activeParts(p).filter(a=>a.kind==='button'))circleHole(s,a.position[0],a.position[1],a.size[0]/2+p.clearance);const buzz=p.parts.find(a=>a.id==='buzzer')!;for(let i=-1;i<=1;i++)hole(s,buzz.position[0]+i*3,buzz.position[1],1.2,8);}for(const x of [-1,1])for(const y of [-1,1])circleHole(s,x*(w/2-7),y*(h/2-7),1.4);return s;},[p,rear,w,h]);
 const opacity=mode==='Transparent'?0.19:1;
 const side=useMemo(()=>{const s=new THREE.Shape(),r=8;s.moveTo(-w/2+r,-h/2);s.quadraticCurveTo(-w/2,-h/2,-w/2,-h/2+r);s.lineTo(-w/2,h/2-r);s.quadraticCurveTo(-w/2,h/2,-w/2+r,h/2);s.lineTo(w/2-r,h/2);s.quadraticCurveTo(w/2,h/2,w/2,h/2-r);s.lineTo(w/2,-h/2+r);s.quadraticCurveTo(w/2,-h/2,w/2-r,-h/2);s.lineTo(w/2-r,-h/2+t);s.quadraticCurveTo(w/2-t,-h/2+t,w/2-t,-h/2+r);s.lineTo(w/2-t,h/2-r);s.quadraticCurveTo(w/2-t,h/2-t,w/2-r,h/2-t);s.lineTo(-w/2+r,h/2-t);s.quadraticCurveTo(-w/2+t,h/2-t,-w/2+t,h/2-r);s.lineTo(-w/2+t,-h/2+r);s.quadraticCurveTo(-w/2+t,-h/2+t,-w/2+r,-h/2+t);s.closePath();return s;},[w,h,t]);
 const boss=useMemo(()=>{const s=new THREE.Shape();s.absarc(0,0,3.2,0,Math.PI*2,false);circleHole(s,0,0,1.4);return s},[]);
 const sideGeo=useMemo(()=>new THREE.ExtrudeGeometry(side,{depth:d-2*t-0.5,bevelEnabled:false,curveSegments:24}),[side,d,t]);
 useEffect(()=>()=>sideGeo.dispose(),[sideGeo]);
 if(rear)return <group><Plate shape={face} depth={t} z={0} color="#bac4c3" opacity={opacity}/>{activeParts(p).filter(a=>a.kind==='button').map((a,i)=><group key={a.id} position={[a.position[0],a.position[1]-8,-0.1]} rotation={[0,Math.PI,0]}><PrintLabel text={['POWER','MODE','AUX'][i]} position={[0,0,0]} width={12} height={2}/></group>)}</group>;
 return <group>
  {mode!=='Cutaway'&&<FrontDetails p={p} opacity={opacity}/>}
  {mode!=='Cutaway'&&<Plate shape={face} depth={t} z={d/2-t} opacity={opacity}/>}
  <mesh geometry={sideGeo} position={[0,0,-d/2+t+0.5]} castShadow receiveShadow><meshStandardMaterial color="#d4dcd9" roughness={0.72} transparent={opacity<1} opacity={opacity} side={THREE.DoubleSide}/></mesh>
  {/* Bottom wall is segmented around a real charging-port opening. */}
  <Box size={[w-36,t,d-2*t]} position={[-10,-h/2+t/2,0]} opacity={opacity}/><Box size={[6,t,d-2*t]} position={[w/2-11,-h/2+t/2,0]} opacity={opacity}/><Box size={[14,t,d/2-7]} position={[w/2-21,-h/2+t/2,d/4+3.5]} opacity={opacity}/><Box size={[14,t,d/2-7]} position={[w/2-21,-h/2+t/2,-d/4-3.5]} opacity={opacity}/>
  {[-1,1].flatMap(x=>[-1,1].map(y=><group key={x+','+y} position={[x*(w/2-7),y*(h/2-7),0]}><Plate shape={boss} depth={d-2*t} z={-d/2+t} color="#c4ccca" opacity={opacity}/></group>))}
 </group>;
}
function OLED({state,direction,size}:{state:string;direction:string;size:Vec3}){
 const texture=useMemo(()=>{const c=document.createElement('canvas');c.width=256;c.height=128;const x=c.getContext('2d')!;x.fillStyle='#061a1b';x.fillRect(0,0,256,128);x.fillStyle='#a9f6e9';x.font='bold 13px monospace';x.fillText('AI COUGH DETECTOR',12,22);x.fillRect(12,32,232,1);x.font='bold 17px monospace';x.fillText(state.toUpperCase(),12,61);x.font='12px monospace';x.fillText(state==='Direction estimated'?'DIRECTION: '+direction:'AUDIO MONITORING',12,84);x.fillText('SIMULATION     BAT '+(state==='Battery low'?'12':state==='Charging'?'48':'82')+'%',12,111);const t=new THREE.CanvasTexture(c);t.magFilter=THREE.NearestFilter;t.colorSpace=THREE.SRGBColorSpace;return t;},[state,direction]);useEffect(()=>()=>texture.dispose(),[texture]);
 return <><Box size={size} color="#114c50"/><Box size={[size[0]-1,size[1]-6,1.5]} position={[0,0,size[2]/2]} color="#172627"/><mesh position={[0,0,size[2]/2+0.8]}><planeGeometry args={[size[0]-3,size[1]-10]}/><meshBasicMaterial map={texture}/></mesh>{[-1,1].map(i=><Box key={i} size={[3,size[1]+2,3]} position={[i*(size[0]/2+1),0,-1]} color="#9ca9a6"/>)}</>;
}
function Frame({p}:{p:Project}){
 const [w,h]=enclosure(p),frameZ=p.parts.find(a=>a.id==='frame')!.position[2];
 const boards=p.parts.filter(a=>['mic','carrier','charger','regulator','driver','sense','protection'].includes(a.kind));
 return <group>
 {[-1,1].map(i=><Box key={'rail'+i} size={[3,h-20,3]} position={[i*(w/2-14),0,0]} color="#8d9c99"/>)}
 {[-1,1].map(i=><Box key={'cross'+i} size={[w-25,3,3]} position={[0,i*(h/2-17),0]} color="#8d9c99"/>)}
 {boards.map(a=>{const height=Math.max(2,a.position[2]-frameZ-a.size[2]/2-2);return <group key={a.id} position={[a.position[0],a.position[1],0]} rotation={[0,0,a.rotation[2]*Math.PI/180]}>
 <Box size={[a.size[0]+5,a.size[1]+4,1]} color="#8d9c99"/>
 {[-1,1].map(i=><group key={i} position={[i*(a.size[0]/2+1.5),-a.size[1]/2,0]}><Box size={[2,3,height]} position={[0,0,height/2]} color="#8d9c99"/></group>)}
 <group position={[0,0,height]}><Box size={[a.size[0]+5,2,3]} position={[0,-a.size[1]/2-1,0]} color="#8d9c99"/>{[-1,1].map(i=><Box key={i} size={[2,a.size[1]+2,3]} position={[i*(a.size[0]/2+1.5),0,0]} color="#8d9c99"/>)}</group>
 </group>})}
 {(()=>{const b=p.parts.find(a=>a.id==='battery')!;return <group position={[b.position[0],b.position[1],b.position[2]-frameZ-b.size[2]/2-2]}><Box size={[b.size[0]+5,b.size[1]+5,1.5]} color="#8d9c99"/>{[-1,1].map(i=><Box key={i} size={[b.size[0]+5,2,5]} position={[0,i*(b.size[1]/2+2),2]} color="#8d9c99"/>)}</group>})()}
 </group>;
}
const Model=memo(function Model({a,p,mode,onAsset}:{a:Part;p:Project;mode:ViewMode;onAsset:ViewerProps['onAsset']}){
 if(a.kind==='front'||a.kind==='rear')return <Shell p={p} rear={a.kind==='rear'} mode={mode}/>;
 if(a.kind==='frame')return <Frame p={p}/>;
 if(['mic','esp','carrier'].includes(a.kind))return <CAD part={a} onAsset={onAsset}/>;
 if(a.kind==='oled')return <OLED state={p.oled} direction={p.direction} size={a.size}/>;
 if(a.kind==='button'||a.kind==='buzzer')return <group rotation={[Math.PI/2,0,0]}><mesh castShadow><cylinderGeometry args={[a.size[0]/2,a.size[0]/2,a.size[2],32]}/><meshStandardMaterial color={a.kind==='button'?'#294542':'#172224'} roughness={0.65}/></mesh>{a.kind==='buzzer'&&<mesh position={[0,-a.size[2]/2-0.1,0]} rotation={[Math.PI/2,0,0]}><circleGeometry args={[2,20]}/><meshBasicMaterial color="black" side={THREE.DoubleSide}/></mesh>}</group>;
 if(a.kind==='battery'&&p.battery==='18650')return <group rotation={[0,0,Math.PI/2]}><mesh castShadow><cylinderGeometry args={[a.size[1]/2,a.size[1]/2,a.size[0],40]}/><meshStandardMaterial color="#55797a" roughness={0.5}/></mesh>{[-1,1].map(i=><mesh key={i} position={[0,i*a.size[0]/2,0]}><cylinderGeometry args={[6,6,0.6,24]}/><meshStandardMaterial color="#bdc5c5" metalness={0.7} roughness={0.3}/></mesh>)}</group>;
 if(a.kind==='battery')return <><Box size={a.size} color="#b5bfc2" radius={2}/><Box size={[a.size[0]-8,a.size[1]-5,0.15]} position={[0,0,a.size[2]/2+0.1]} color="#e3e7df"/><Box size={[5,a.size[1],a.size[2]+0.3]} position={[-a.size[0]/2+3,0,0]} color="#c7a348"/></>;
 return <><Box size={a.size} color={a.kind==='carrier'?'#1d6252':'#1f6977'}/><Box size={[a.size[0]*0.45,a.size[1]*0.4,2]} position={[0,0,a.size[2]/2+1]} color="#252d2f"/>{[-1,1].map(i=><Box key={i} size={[1.5,a.size[1]-4,1]} position={[i*(a.size[0]/2-2),0,a.size[2]/2+0.5]} color="#bdac6d"/>)}{a.kind==='charger'&&<Box size={[8,5,3]} position={[0,-a.size[1]/2,1]} color="#b5c1c3"/>}</>;
});
function AnimatedPart({a,index,props}:{a:Part;index:number;props:ViewerProps}){
 const ref=useRef<THREE.Group>(null),{project:p,mode}=props;
 const [,,d]=enclosure(p);const pos:Vec3=[...a.position];if(a.kind==='rear')pos[2]=-d/2;
 const factor=mode==='Exploded'?props.explode:0;
 pos[2]+=factor*(a.kind==='front'?75:a.kind==='rear'?-85:a.kind==='frame'?-45:a.kind==='battery'?-20:a.kind==='mic'||a.kind==='oled'?38:4);
 if(mode==='Exploded'&&a.kind==='mic')pos[0]+=factor*(index-4)*8;
 useFrame((_,dt)=>{ref.current?.position.lerp(new THREE.Vector3(...pos),1-Math.exp(-dt*8));});
 const visible=a.visible&&(!props.isolate||props.isolate===a.id)&&!(mode==='Internal'&&['front','rear'].includes(a.kind));
 return <group ref={ref} position={pos} rotation={a.rotation.map(v=>v*Math.PI/180) as Vec3} visible={visible} name={a.id} userData={{componentId:a.id,label:a.label,units:'mm',source:a.source}} onClick={e=>{e.stopPropagation();props.select(a.id)}}>
 <Model a={a} p={p} mode={mode} onAsset={props.onAsset}/>
 {props.selected===a.id&&!['front','frame'].includes(a.kind)&&<mesh><boxGeometry args={a.size.map(v=>v+1) as Vec3}/><meshBasicMaterial color="#6ee7cf" wireframe transparent opacity={0.6}/></mesh>}
 </group>;
}
function CameraRig({view,tick,playing}:{view:string;tick:number;playing?:boolean}){const {camera}=useThree();const controls=useRef<any>(null);useEffect(()=>{const poses:Record<string,Vec3>={Isometric:[180,130,240],Front:[0,0,290],Rear:[0,0,-290],Left:[-290,0,0],Right:[290,0,0],Top:[0,290,0.01],Bottom:[0,-290,0.01]};camera.position.set(...(poses[view]||poses.Isometric));camera.up.set(0,1,0);camera.lookAt(0,0,0);controls.current?.target.set(0,0,0);controls.current?.update();},[view,tick,camera]);return <OrbitControls ref={controls} autoRotate={playing} autoRotateSpeed={1.1} makeDefault minDistance={70} maxDistance={650} enableDamping dampingFactor={0.09}/>}
function Coverage({p}:{p:Project}){return <group position={[0,52,25]} rotation={[Math.PI/2,0,0]}>{[0,1,2].map(i=><group key={i}><mesh rotation={[0,0,i*Math.PI/3]}><circleGeometry args={[105,36,0,Math.PI/3]}/><meshBasicMaterial color={['#419a94','#64d1bc','#438ba5'][i]} transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false}/></mesh></group>)}<Line points={Array.from({length:61},(_,i)=>[105*Math.cos(i*Math.PI/60),105*Math.sin(i*Math.PI/60),0])} color="#63c7b5" transparent opacity={0.5}/><Html position={[0,115,0]} center><span className="coverage-label">180° TARGET · NOT VALIDATED</span></Html>{p.parts.filter(a=>a.kind==='mic').map(a=><Line key={a.id} points={[[a.position[0],0,0],[a.position[0]+Math.sin(a.rotation[1]*Math.PI/180)*60,60,0]]} color="#8ce7d4" dashed dashSize={2} gapSize={2}/>)}</group>}
function Scene(props:ViewerProps){const group=useRef<THREE.Group>(null);useEffect(()=>{if(group.current)props.onScene(group.current)},[props.onScene]);const p=props.project;return <>
 <color attach="background" args={['#172023']}/><ambientLight intensity={0.8}/><hemisphereLight args={['#d4e8eb','#3a4b4c',1.5]}/><directionalLight position={[80,160,150]} intensity={3} castShadow shadow-mapSize={[2048,2048]} shadow-camera-left={-180} shadow-camera-right={180} shadow-camera-top={180} shadow-camera-bottom={-180} shadow-camera-far={700} shadow-bias={-0.0004}/><directionalLight position={[-150,10,-90]} intensity={1.5} color="#77b7c7"/>
 <group ref={group} name="AURA-device-mm">{activeParts(p).map((a,i)=><AnimatedPart key={a.id} a={a} index={i} props={props}/>)}</group>
 <gridHelper args={[600,60,'#344347','#253236']} position={[0,-enclosure(p)[1]/2-5,0]}/>
 {props.coverage&&<Coverage p={p}/>}
 {props.wiring&&p.wires.filter(w=>w.enabled&&activeParts(p).some(a=>a.id===w.from)).map((w,i)=>{const a=p.parts.find(a=>a.id===w.from)!,b=p.parts.find(a=>a.id===w.to)!,offset=(i%6-2.5)*0.65;return <Line key={w.id} points={[[a.position[0]+offset,a.position[1],a.position[2]],[a.position[0]+offset,a.position[1],-9-offset],[b.position[0]+offset,a.position[1],-9-offset],[b.position[0]+offset,b.position[1],b.position[2]]]} color={wireColor(w)} lineWidth={1.2}/>})}
 {['Transparent','Cutaway','Internal'].includes(props.mode)&&(()=>{const a=p.parts.find(a=>a.id==='esp')!;return <group position={a.position} rotation={a.rotation.map(v=>v*Math.PI/180) as Vec3}><mesh position={[0,17,0]}><boxGeometry args={[48,21,24]}/><meshBasicMaterial color="#d9bc7d" wireframe transparent opacity={0.3}/></mesh></group>})()}
 <CameraRig view={props.camera} tick={props.cameraKey} playing={props.playing}/>
 </>}
export default function DeviceViewer(props:ViewerProps){return <Canvas shadows camera={{position:[180,130,240],fov:37,near:0.1,far:2000}} gl={{antialias:true,localClippingEnabled:true,preserveDrawingBuffer:true}} dpr={[1,1.5]} onPointerMissed={()=>props.select('')}><Suspense fallback={<Html center><span className="loading">Loading geometry…</span></Html>}><Scene {...props}/></Suspense></Canvas>}
