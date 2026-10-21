import fs from 'node:fs';
import * as THREE from 'three';
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
globalThis.FileReader=class{readAsArrayBuffer(b){b.arrayBuffer().then(v=>{this.result=v;this.onloadend?.()})}readAsDataURL(b){b.arrayBuffer().then(v=>{this.result='data:'+b.type+';base64,'+Buffer.from(v).toString('base64');this.onloadend?.()})}};
for(const file of ['microphone/inmp441','microcontroller/esp32-s3-wroom-1','microcontroller/carrier']){
 const d=JSON.parse(fs.readFileSync('public/models/'+file+'.json'));
 const root=new THREE.Group(),byColor=new Map();
 for(const m of d.meshes){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(m.attributes.position.array.map(v=>v/1000),3));g.setIndex(m.index.array);if(m.attributes.normal)g.setAttribute('normal',new THREE.Float32BufferAttribute(m.attributes.normal.array,3));else g.computeVertexNormals();const color=m.color||[0.5,0.55,0.54],key=color.join(',');if(!byColor.has(key))byColor.set(key,{color,geometries:[]});byColor.get(key).geometries.push(g);}
 for(const {color,geometries} of byColor.values()){root.add(new THREE.Mesh(mergeGeometries(geometries),new THREE.MeshStandardMaterial({color:new THREE.Color(...color),roughness:0.55,metalness:0.2})));}
 root.userData={source:d.source,sourceUnits:'mm',glbUnits:'m',dimensionsMM:d.dimensions,partitionNote:d.partitionNote||null};
 const glb=await new GLTFExporter().parseAsync(root,{binary:true});fs.writeFileSync('public/models/'+file+'.glb',Buffer.from(glb));
 fs.writeFileSync('public/models/'+file+'.meta.json',JSON.stringify({...root.userData,assemblyCenter:d.assemblyCenter,originalCenter:d.originalCenter},null,2));console.log(file,glb.byteLength,'bytes',root.children.length,'draw calls');
}
