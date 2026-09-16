import * as THREE from 'three';
import {previewFactories} from '../src/previewModels.js';
import {modelSlots} from '../src/modelSlots.js';
// Conservative world-space boxes across one minute of the actual float motion.
const entries=modelSlots.map((slot,index)=>{
 const object=previewFactories[slot.id]();
 const bounds=new THREE.Box3().setFromObject(object),size=bounds.getSize(new THREE.Vector3());
 object.position.sub(bounds.getCenter(new THREE.Vector3()));
 const wrapper=new THREE.Group();wrapper.add(object);wrapper.scale.setScalar(slot.size/Math.max(size.x,size.y,size.z));
 const pivot=new THREE.Group();pivot.add(wrapper);pivot.position.set(slot.x,slot.y,slot.z);pivot.rotation.set(...slot.rotation);
 return {slot,index,pivot,bounds:new THREE.Box3()};
});
const failures=new Set();
for(let frame=0;frame<=360;frame++){
 const time=frame/6;
 for(const {slot,index,pivot,bounds} of entries){
  pivot.position.y=slot.y+(slot.bounce?Math.sin(time*1.8+index*1.7)*.0025:0);
  pivot.rotation.z=slot.rotation[2]+(slot.bounce?Math.sin(time*1.3+index)*.035:0);
  pivot.updateMatrixWorld(true);bounds.setFromObject(pivot);
 }
 for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++)if(entries[i].bounds.intersectsBox(entries[j].bounds))failures.add(`${entries[i].slot.id}/${entries[j].slot.id}`);
}
console.log(JSON.stringify({sampledSeconds:60,samples:361,intersectingPairs:[...failures]}));
if(failures.size)process.exitCode=1;
