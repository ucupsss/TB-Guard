import * as THREE from 'three';
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js';
import {activeParts,acousticPath,enclosure,type Project} from './engineering';
export function download(name:string,content:BlobPart,type='text/plain'){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function exportJSON(p:Project){download('aura-project.json',JSON.stringify(p,null,2),'application/json');}
export function exportCSV(p:Project){const csv=(v:unknown)=>'"'+String(v).replace(/"/g,'""')+'"';download('aura-inventory.csv',[['ID','Component','Quantity','Width mm','Height mm','Depth mm','Evidence','Mounting','Notes'],...activeParts(p).map(a=>[a.id,a.label,1,...a.size,a.source,a.mount,a.note])].map(row=>row.map(csv).join(',')).join('\r\n'),'text/csv');}
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
export function exportWiring(p:Project){const wires=p.wires.filter(w=>w.enabled&&activeParts(p).some(a=>a.id===w.from));const h=120+wires.length*75;download('aura-conceptual-wiring.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="${h}" viewBox="0 0 1100 ${h}"><rect width="1100" height="${h}" fill="#172023"/><g font-family="monospace" fill="#e2ede9"><text x="30" y="35" font-size="20">AURA / Conceptual wiring · UNVERIFIED</text><text x="30" y="62" font-size="12">Routes are not final GPIO assignments. Verify channels, protection, regulation and firmware.</text>${wires.map((w,i)=>`<g transform="translate(30,${100+i*75})"><rect width="210" height="48" rx="5" fill="#2a3c3c"/><text x="12" y="29">${esc(p.parts.find(a=>a.id===w.from)!.label)}</text><path d="M210 24H770" stroke="#6bd8be"/><text x="230" y="12" font-size="11">${esc(w.signal)}</text><text x="230" y="45" font-size="11" fill="#e4be79">${esc(w.pin)} · unverified</text><rect x="770" width="270" height="48" rx="5" fill="#2a3c3c"/><text x="782" y="29">${esc(p.parts.find(a=>a.id===w.to)!.label)}</text></g>`).join('')}</g></svg>`,'image/svg+xml');}
export async function exportGLB(scene:THREE.Group,p:Project,selected?:string){
 const root=new THREE.Group();root.name='AURA_visualization_metres';root.userData={warning:'Contains estimated parts. Not manufacturing CAD.',projectUnits:'mm',exportUnits:'m'};
 for(const part of activeParts(p).filter(a=>!selected||a.id===selected)){const source=scene.children.find(o=>o.name===part.id);if(!source)continue;const c=source.clone(true);c.visible=true;c.position.set(...part.position);if(part.kind==='rear')c.position.z=-enclosure(p)[2]/2;c.traverse(o=>{if(o instanceof THREE.Mesh){const m=o.material as THREE.MeshStandardMaterial;if(m.wireframe)o.visible=false;else {o.material=m.clone();(o.material as THREE.MeshStandardMaterial).opacity=1;(o.material as THREE.MeshStandardMaterial).transparent=false;}}});root.add(c);}
 root.scale.setScalar(0.001);root.updateMatrixWorld(true);
 const data=await new GLTFExporter().parseAsync(root,{binary:true,onlyVisible:true});if(!(data instanceof ArrayBuffer))throw Error('Unexpected exporter result');download(selected?'aura-'+selected+'.glb':'aura-assembly.glb',data,'model/gltf-binary');root.traverse(o=>{if(o instanceof THREE.Mesh)(o.material as THREE.Material).dispose()});
}
export function exportCAD(p:Project){const [w,h,d]=enclosure(p),t=p.wall;const mic=p.parts.filter(a=>a.kind==='mic'),oled=p.parts.find(a=>a.kind==='oled')!,buzzer=p.parts.find(a=>a.kind==='buzzer')!;
 download('aura-enclosure-handoff.scad',`// AURA provisional enclosure CAD handoff. Units: mm.
// Open in OpenSCAD, inspect, F6 render, then export STL for a FIT TEST.
// Not production-ready. Confirm every purchased component, mounts, wires,
// port registration, fasteners, battery safety and FDM tolerances first.
// STEP: reconstruct/validate solids in FreeCAD; do not relabel a GLB as STEP.
$fn=48; W=${w}; H=${h}; D=${d}; wall=${t}; clearance=${p.clearance};
part="front"; // [front,rear,frame]
module slab(w,h,z,r=8){linear_extrude(z) offset(r=r) square([w-2*r,h-2*r],center=true);}
module front(){difference(){translate([0,0,-D/2+wall]) slab(W,H,D-wall);translate([0,0,-D/2-1]) slab(W-2*wall,H-2*wall,D-wall*2+1,8-wall);
translate([${oled.position[0]},${oled.position[1]},D/2]) cube([${oled.size[0]-3},${oled.size[1]-10},wall*3],center=true);
${mic.map(a=>{const port=acousticPath(p,a);return `translate([${port.entry[0]},${port.entry[1]},D/2-wall-1]) cylinder(h=wall+2,r=2.2);`}).join('\n')}

translate([W/2-21,-H/2,0]) cube([14,wall*3,14],center=true);
for(x=[-1,1])for(y=[-1,1])translate([x*(W/2-7),y*(H/2-7),-D]) cylinder(h=D*2,r=1.4);
}for(x=[-1,1])for(y=[-1,1])translate([x*(W/2-7),y*(H/2-7),-D/2+wall]) difference(){cylinder(h=D-wall*2,r=3.2);translate([0,0,-1])cylinder(h=D,r=1.4);}}
module rear(){difference(){slab(W,H,wall);${activeParts(p).filter(a=>a.kind==='button').map(a=>`translate([${a.position[0]},${a.position[1]},-1]) cylinder(h=wall+2,r=${a.size[0]/2+p.clearance});`).join('\n')}for(x=[-1,1])for(y=[-1,1])translate([x*(W/2-7),y*(H/2-7),-1])cylinder(h=wall+2,r=1.4);for(i=[-1:1])translate([${buzzer.position[0]}+i*3,${buzzer.position[1]},wall/2])cube([1.2,8,wall*3],center=true);}}
module frame(){for(x=[-1,1])translate([x*(W/2-14),0,0])cube([3,H-20,3],center=true);for(y=[-1,1])translate([0,y*(H/2-17),0])cube([W-25,3,3],center=true);}
if(part=="front")front();if(part=="rear")rear();if(part=="frame")frame();
// Frame handoff includes rails only. Detail brackets from verified board drawings.
`);}
