const fs=require('fs');
const file='public/models/microcontroller/esp32-s3-wroom-1.json';
const all=JSON.parse(fs.readFileSync(file));
if(all.partitioned)throw Error('Re-run convert:cad before split');
const bounds=m=>{const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];m.attributes.position.array.forEach((v,i)=>{lo[i%3]=Math.min(lo[i%3],v);hi[i%3]=Math.max(hi[i%3],v)});return {lo,hi}};
const moduleMeshes=[],carrier=[];
for(const m of all.meshes){const {lo,hi}=bounds(m);(lo[0]>=-9.01&&hi[0]<=9.01&&lo[1]>=6.18&&hi[1]<=31.71&&lo[2]>=3.17?moduleMeshes:carrier).push(m);}
for(const [name,meshes] of [['esp32-s3-wroom-1',moduleMeshes],['carrier',carrier]]){
 const boxes=meshes.map(bounds),lo=[0,1,2].map(i=>Math.min(...boxes.map(b=>b.lo[i]))),hi=[0,1,2].map(i=>Math.max(...boxes.map(b=>b.hi[i]))),center=lo.map((v,i)=>(v+hi[i])/2),dimensions=lo.map((v,i)=>hi[i]-v);
 for(const m of meshes)m.attributes.position.array=m.attributes.position.array.map((v,i)=>v-center[i%3]);
 fs.writeFileSync('public/models/microcontroller/'+name+'.json',JSON.stringify({units:'mm',partitioned:true,source:'esp32-s3-wroom-1.step',partitionNote:'Geometry partition by module envelope; inspect source for manufacturing.',dimensions,assemblyCenter:center,meshes}));
 console.log(name,{dimensions,center,meshes:meshes.length});
}
