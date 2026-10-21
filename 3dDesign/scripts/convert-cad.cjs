const fs = require('fs');
const path = require('path');
const init = require('occt-import-js');
// OCCT tessellates in millimetres. Geometry is centered, never rescaled.
(async()=>{
 const occt = await init();
 const inputs = [
 ['microphone','inmp441','C:/Users/ahmad/Downloads/3d design/inmp441-i2s-microphone-module-1.snapshot.1/INMP441 I2S Microphone Module v15.step'],
 ['microcontroller','esp32-s3-wroom-1','C:/Users/ahmad/Downloads/3d design/esp32-s3-wroom-1-1.snapshot.2/ESP32-S3-WROOM-1.STEP']
 ];
 for(const [folder,name,source] of inputs){
  const dir=path.join('public/models',folder);fs.mkdirSync(dir,{recursive:true});
  if(!fs.existsSync(source)){console.error('Missing CAD: '+source);process.exitCode=1;continue;}
  fs.copyFileSync(source,path.join(dir,name+'.step'));
  const result=occt.ReadStepFile(fs.readFileSync(source),{linearUnit:'millimeter',linearDeflectionType:'absolute_value',linearDeflection:0.08,angularDeflection:0.3});
  if(!result.success)throw Error('STEP conversion failed: '+name);
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const mesh of result.meshes)for(let i=0;i<mesh.attributes.position.array.length;i++){const a=i%3,v=mesh.attributes.position.array[i];min[a]=Math.min(min[a],v);max[a]=Math.max(max[a],v);}
  const center=min.map((v,i)=>(v+max[i])/2);
  for(const mesh of result.meshes)mesh.attributes.position.array=mesh.attributes.position.array.map((v,i)=>v-center[i%3]);
  const output={units:'mm',source:name+'.step',dimensions:min.map((v,i)=>max[i]-v),originalCenter:center,meshes:result.meshes};
  fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify(output));
  console.log(name,JSON.stringify({dimensions:output.dimensions,meshes:result.meshes.length,triangles:result.meshes.reduce((s,m)=>s+m.index.array.length/3,0)}));
 }
})();
