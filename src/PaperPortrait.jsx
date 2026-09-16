import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { previewFactories, releaseObject } from './previewModels.js';
import { modelSlots } from './modelSlots.js';
import tearProfile from './tearProfile.json';

// Original implementation of cylindrical paper bending, informed by
// https://tympanus.net/codrops/2020/01/22/how-to-unroll-images-with-three-js/
// One shared deformation and cut line for the visible sheet and its shadow.
// The opening is geometric: no chroma key can punch holes in the intact photo.
const paperShape = `
 uniform sampler2D tearContour;
 uniform float lowerProgress;
 float tearLine(float x){return texture2D(tearContour,vec2(x,.5)).r;}
 // The printed layer reaches below the remaining white fibre fringe.
 float inkLine(float x){return tearLine(x)-.021-.0015*sin(x*67.);}
 vec2 peelDirection(){return normalize(vec2(1.,-.34));}
 float peelFront(float progress){return mix(.37,-.55,smoothstep(.03,.84,progress));}
 float peelDistance(vec2 point,float progress){return max(0.,dot(point,peelDirection())-peelFront(progress));}
 // A second, separate peel begins at the left edge of the remaining face.
 // Its front travels rightwards, mirroring the upper peel so the lower half
 // tears off toward the right side of the page; unreached paper never changes shape.
 vec2 lowerDirection(){return normalize(vec2(-1.,-.30));}
 float lowerFront(float p){return mix(.60,-.55,smoothstep(0.,.55,p));}
 float lowerDistance(vec2 point,float p){return max(0.,dot(point,lowerDirection())-lowerFront(p));}
 vec3 peel(vec3 p,float progress,float upper){
   if(upper<.5){
     float d=lowerDistance(p.xy,lowerProgress);
     float radius=.135;
     float angle=min(d/radius,3.14159265);
     float travel=d<=3.14159265*radius?d-radius*sin(angle):2.*d-3.14159265*radius;
     // Preserve a readable paper flap while the diagonal front crosses the face.
     travel=min(travel,.78);
     p.xy-=lowerDirection()*travel;
     p.z+=radius*(1.-cos(angle));
     // The exit starts while the peel is still finishing: the torn flap
     // keeps moving up-right at 45° in one continuous motion and never
     // parks half-visible at the right edge of the viewport.
     float depart=smoothstep(.30,.70,lowerProgress);
     p.xy+=vec2(2.2,2.2)*depart;
     p.z+=depart*.12;
     return p;
   }
   vec2 direction=peelDirection();
   float d=peelDistance(p.xy,progress);
   float radius=.062;
   float angle=min(d/radius,3.14159265);
   // Roll the moving corner through a cylinder, then keep the flipped flap intact.
   // Unreached vertices stay exactly on the original photograph.
   float travel=d<=3.14159265*radius?d-radius*sin(angle):2.*d-3.14159265*radius;
   p.xy-=direction*travel;
   p.z+=radius*(1.-cos(angle));
   float depart=smoothstep(.84,1.,progress);
   p.xy+=vec2(-1.9,1.6)*depart;p.z+=depart*.10;
   return p;
 }`;
const vertex = `
 varying vec2 vUv; varying float vCurve;
 uniform float progress; uniform float upper;
 ${paperShape}
 void main(){
   vUv=uv;vec3 p=peel(position,progress,upper);
   vCurve=upper>.5?min(peelDistance(position.xy,progress)/.062,3.14159265):min(lowerDistance(position.xy,lowerProgress)/.135,3.14159265);
   gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
 }`;
const fragment = `
 uniform sampler2D portrait; uniform sampler2D paperDetail; uniform float upper; uniform float progress; uniform float shadowOnly;
 varying vec2 vUv; varying float vCurve;
 ${paperShape}
 void main(){
   vec4 col=texture2D(portrait,vUv);if(col.a<.02)discard;col.rgb/=max(col.a,.02);
   float edge=vUv.y-tearLine(vUv.x);
   if(upper>.5 && vUv.y<inkLine(vUv.x))discard;
   if(upper<.5 && edge>=0.)discard;
   // Fibres become visible only behind the moving peel, never across the intact head.
   float localLift=peelDistance(vec2(vUv.x-.5,inkLine(vUv.x)-.5),progress);
   // Binary spatial reveal: no opacity fade. The attached printed flap covers the fibres.
   float exposed=step(.012,localLift);
   // Recover only neutral paper fibres from the old tear reference, never its face or blue background.
   vec3 detail=texture2D(paperDetail,vUv).rgb;
   float white=min(detail.r,min(detail.g,detail.b));
   float neutral=1.-smoothstep(.17,.20,max(detail.r,max(detail.g,detail.b))-white);
   float paperMask=smoothstep(.27,.30,white)*neutral;
   float band=1.-smoothstep(.020,.031,abs(edge));
   float endCap=1.-smoothstep(.17,.195,vUv.x)+smoothstep(.80,.835,vUv.x);
   float cleanEnd=smoothstep(-.0135,-.0128,edge)*step(.5,endCap);
   float fibreShape=max(max(paperMask*band,cleanEnd),1.-smoothstep(.001,.0035,abs(edge)));
   float fibres=smoothstep(.48,.52,fibreShape)*exposed;
   float paperTone=mix(.965,1.,smoothstep(.30,.95,white));
   if(upper<.5)col.rgb=mix(col.rgb,vec3(paperTone),fibres);
   if(!gl_FrontFacing)col.rgb=vec3(.97);
   col.rgb*=1.-.30*abs(sin(vCurve));
   if(shadowOnly>.5){
     col.rgb=vec3(.16);col.a*=.065;
     // The silhouette follows its sticker on the same 45° up-right exit and
     // fades out with it. Once the sticker has left, this is hard-clamped to
     // zero, so the silhouette can never reappear over the next page.
     float silhouetteGone=upper<.5?smoothstep(.30,.70,lowerProgress):smoothstep(.84,1.,progress);
     col.a*=1.-silhouetteGone;
   }
   gl_FragColor=col;
   #include <colorspace_fragment>
 }`;
export default function PaperPortrait({progress,lowerProgress=0,scatter=0,paused=false}){
 const ref=useRef(null),progressRef=useRef(progress),lowerRef=useRef(lowerProgress),scatterRef=useRef(scatter),pausedRef=useRef(paused),[ready,setReady]=useState(false);
 progressRef.current=progress; lowerRef.current=lowerProgress; scatterRef.current=scatter; pausedRef.current=paused;
 useEffect(()=>{
   const host=ref.current;if(!host)return;let renderer,disposed=false,frame,texture,environment,paperDetail;const modelGroups=[];const extraResources=[];const depthMaterials=[];
   const contour=new THREE.DataTexture(new Float32Array(tearProfile),tearProfile.length,1,THREE.RedFormat,THREE.FloatType);
   contour.minFilter=THREE.LinearFilter;contour.magFilter=THREE.LinearFilter;contour.needsUpdate=true;
   paperDetail=new THREE.TextureLoader().load('/images/paper-tear-source.png',t=>{t.colorSpace=THREE.SRGBColorSpace;});
   const modelSources={};const materials=[];const geometry=new THREE.PlaneGeometry(1,1,144,144);
   const scene=new THREE.Scene();const camera=new THREE.OrthographicCamera(-.9,.9,.9,-.9,.01,20);camera.position.z=5;
   try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,premultipliedAlpha:true});}catch{geometry.dispose();return;}
   renderer.setClearColor(0,0);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.93;renderer.setPixelRatio(Math.min(devicePixelRatio,2.5));host.appendChild(renderer.domElement);
   const pmrem=new THREE.PMREMGenerator(renderer);const room=new RoomEnvironment();environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;scene.environmentIntensity=.40;room.dispose();pmrem.dispose();
   scene.add(new THREE.HemisphereLight(0xffffff,0x7b7164,.5));const key=new THREE.DirectionalLight(0xffffff,2.1);key.position.set(-.6,.9,4.);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-.75;key.shadow.camera.right=.75;key.shadow.camera.top=.65;key.shadow.camera.bottom=-.55;key.shadow.camera.near=.1;key.shadow.camera.far=8;key.shadow.bias=-.00006;key.shadow.normalBias=.0008;key.shadow.radius=5;key.target.position.set(0,.16,-.15);scene.add(key.target);scene.add(key);const fill=new THREE.DirectionalLight(0xffe9c5,.35);fill.position.set(3,0,2);scene.add(fill);
   function verifyClearance(){
     if(Object.keys(modelSources).length!==modelSlots.length)return;
     const conflicts=new Set(),frontViolations=new Set();
     const boxes=modelGroups.map(()=>new THREE.Box3());
     for(let step=0;step<=360;step++){
       const t=step/6;
       modelGroups.forEach(({pivot,slot,index},i)=>{
         pivot.position.y=slot.y+(slot.bounce?Math.sin(t*1.8+index*1.7)*.0025:0);
         pivot.rotation.z=slot.rotation[2]+(slot.bounce?Math.sin(t*1.3+index)*.035:0);
         pivot.updateMatrixWorld(true);boxes[i].setFromObject(pivot);
         if(boxes[i].max.z>=-.005)frontViolations.add(slot.id);
       });
       for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)if(boxes[i].intersectsBox(boxes[j]))conflicts.add(modelGroups[i].slot.id+'/'+modelGroups[j].slot.id);
     }
     host.dataset.modelClearance=JSON.stringify({seconds:60,samples:361,intersectingPairs:[...conflicts],inFrontOfPaper:[...frontViolations]});
   }
   modelSlots.forEach((slot,index)=>{
     const pivot=new THREE.Group();pivot.position.set(slot.x,slot.y,slot.z);pivot.rotation.set(...slot.rotation);scene.add(pivot);modelGroups.push({pivot,slot,index});
     function install(object,source){if(disposed){releaseObject(object);return;}object.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});const bounds=new THREE.Box3().setFromObject(object);const size=bounds.getSize(new THREE.Vector3());const center=bounds.getCenter(new THREE.Vector3());object.position.sub(center);const scale=slot.size/Math.max(size.x,size.y,size.z);const wrapper=new THREE.Group();wrapper.add(object);wrapper.scale.setScalar(scale);pivot.add(wrapper);modelSources[slot.id]=source;host.dataset.modelSources=JSON.stringify(modelSources);verifyClearance();}
     if(slot.url)new GLTFLoader().load(slot.url,gltf=>install(gltf.scene,'lux3d'),undefined,()=>install(previewFactories[slot.id](),'fallback'));else install(previewFactories[slot.id](),'local-preview');
   });
   let baseTop=0,viewHeight=0;
   const resize=()=>{
     const w=host.clientWidth,h=host.clientHeight;
     // Frame the whole sticker: mouth fully visible, chin may slip just past
     // the bottom edge. Models scale along automatically (same world units).
     const headPixels=w>650?Math.min(w,h*1.02):w*1.02;
     camera.left=-w/headPixels/2;camera.right=w/headPixels/2;
     baseTop=w>650?.53:.55;viewHeight=h/headPixels;
     camera.top=baseTop;camera.bottom=baseTop-viewHeight;camera.updateProjectionMatrix();
     host.dataset.portraitScale=w>650?'full-sticker':'mobile-full';host.dataset.headPixels=headPixels.toFixed(1);
     renderer.setSize(w,h,false);
   };const observer=new ResizeObserver(resize);observer.observe(host);resize();
   const onLost=e=>{e.preventDefault();setReady(false);};renderer.domElement.addEventListener('webglcontextlost',onLost);
   new THREE.TextureLoader().load('/images/portrait-final.png',t=>{
     if(disposed){t.dispose();return;}texture=t;t.premultiplyAlpha=true;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=renderer.capabilities.getMaxAnisotropy();
     for(const upper of [0,1]){const material=new THREE.ShaderMaterial({uniforms:{portrait:{value:t},tearContour:{value:contour},paperDetail:{value:paperDetail},shadowOnly:{value:0},progress:{value:0},lowerProgress:{value:0},upper:{value:upper}},vertexShader:vertex,fragmentShader:fragment,side:THREE.DoubleSide,transparent:true,depthWrite:true});materials.push(material);const mesh=new THREE.Mesh(geometry,material);mesh.position.z=upper*.001;mesh.castShadow=true;
       const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:t,alphaTest:.3,side:THREE.DoubleSide});
       depth.onBeforeCompile=shader=>{
         shader.uniforms.progress=material.uniforms.progress;shader.uniforms.lowerProgress=material.uniforms.lowerProgress;shader.uniforms.upper=material.uniforms.upper;shader.uniforms.tearContour=material.uniforms.tearContour;
         shader.vertexShader='uniform float progress;uniform float upper;varying vec2 vPaperUv;\n'+paperShape+'\n'+shader.vertexShader;
         shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
           vPaperUv=uv;transformed=peel(transformed,progress,upper);`);
         shader.fragmentShader='uniform float upper;varying vec2 vPaperUv;\n'+paperShape+'\n'+shader.fragmentShader;
         shader.fragmentShader=shader.fragmentShader.replace('void main() {',`void main() {float edge=vPaperUv.y-tearLine(vPaperUv.x);if(upper>.5&&vPaperUv.y<inkLine(vPaperUv.x))discard;if(upper<.5&&edge>=0.)discard;`);
       };depth.customProgramCacheKey=()=>`printed-layer-peel-depth-${upper}`;mesh.customDepthMaterial=depth;depthMaterials.push(depth);scene.add(mesh);
       // Close, silhouette-matched contact shadow, not a shadow cast on a distant backdrop.
       for(let i=0;i<3;i++){
         const shadowMaterial=material.clone();shadowMaterial.uniforms.progress=material.uniforms.progress;
         shadowMaterial.uniforms.shadowOnly.value=1;shadowMaterial.depthWrite=false;
         const shadow=new THREE.Mesh(geometry,shadowMaterial);
         shadow.position.set(.002+i*.0015,-.003-i*.0015,-.035-i*.001);
         scene.add(shadow);materials.push(shadowMaterial);
       }
     }
     setReady(true);
   },undefined,()=>setReady(false));
   let time=0,last=performance.now();
   function render(){frame=requestAnimationFrame(render);const now=performance.now();if(!pausedRef.current&&!document.hidden)time+=Math.min((now-last)/1000,.05);last=now;
     const p=progressRef.current,l=lowerRef.current;
     materials.forEach(m=>{m.uniforms.progress.value=p;m.uniforms.lowerProgress.value=l;});
     const pan=(l<=.05?0:l>=.38?1:(l-.05)/.33);
     const easedPan=pan*pan*(3-2*pan);
     camera.top=baseTop-.18*easedPan;camera.bottom=camera.top-viewHeight;camera.updateProjectionMatrix();
     // As the lower sticker peels, the models inside the head spread outward
     // and settle scattered across the page — they never fly off or fade away.
     const s0=Math.max(0,Math.min(1,scatterRef.current));
     const es=s0*s0*(3-2*s0);
     // The scattered models belong to the homepage only: as the second page
     // finishes fading in (lowerProgress → 1), they shrink away and never
     // follow the scroll into the next page.
     const pageFade=l<=.72?1:l>=.88?0:1-(l-.72)/.16;
     modelGroups.forEach(({pivot,slot,index})=>{
       const dx=slot.x,dy=slot.y-.22,len=Math.hypot(dx,dy)||1,nx=dx/len,ny=dy/len;
       const spin=(index%2?-1:1)*(2.2+index*.45);
       pivot.visible=p>.07&&pageFade>.02;
       pivot.position.x=slot.x+nx*es*.5;
       pivot.position.y=slot.y+(slot.bounce?Math.sin(time*1.8+index*1.7)*.0025:0)*(1-es)+ny*es*.5+es*es*.1;
       // Small drift toward the viewer only, so models never pierce the sticker.
       pivot.position.z=slot.z+es*(.30+index*.04);
       pivot.rotation.x=slot.rotation[0]+es*spin*.3;
       pivot.rotation.z=slot.rotation[2]+(slot.bounce?Math.sin(time*1.3+index)*.035:0)*(1-es)+es*spin*.6;
       pivot.scale.setScalar(Math.max(pageFade,.0001));
     });
     if(!document.hidden)renderer.render(scene,camera);
   }
   render();
   return()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();renderer.domElement.removeEventListener('webglcontextlost',onLost);geometry.dispose();materials.forEach(m=>m.dispose());texture?.dispose();paperDetail?.dispose();contour.dispose();environment?.dispose();modelGroups.forEach(({pivot})=>releaseObject(pivot));extraResources.forEach(releaseObject);depthMaterials.forEach(m=>m.dispose());key.shadow.map?.dispose();renderer.dispose();renderer.domElement.remove();};
 },[]);
 return <div className="paper-portrait" role="img" aria-label="黄白的不露齿微笑头部贴纸，上半部和下半部分阶段随滚动卷起"><img className={ready?'portrait-fallback hidden':'portrait-fallback'} src="/images/portrait-final.png" alt=""/><div ref={ref} className="paper-webgl"/></div>;
}
