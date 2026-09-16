import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Lux3D files load where ready. A geometry preview remains only while the
// original task is still being generated or if a downloaded file cannot load.
const icons = [
  { id: 'can', url: '/models/can-lux3d.glb' },
  { id: 'earth', url: '/models/earth-lux3d.glb' },
  { id: 'bell', url: '/models/bell-lux3d.glb' },
  { id: 'mortar', url: '/models/mortar-lux3d.glb' },
];

function mesh(geometry, material, parent, position = [0, 0, 0]) {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(...position);
  item.castShadow = true;
  item.receiveShadow = true;
  parent.add(item);
  return item;
}

function makeCan() {
  const group = new THREE.Group();
  const green = new THREE.MeshPhysicalMaterial({ color: 0x22aa61, metalness: .42, roughness: .31, clearcoat: .22 });
  const silver = new THREE.MeshStandardMaterial({ color: 0xe3e9e8, metalness: .75, roughness: .23 });
  mesh(new THREE.CylinderGeometry(.48, .48, 1.12, 64), green, group);
  mesh(new THREE.CylinderGeometry(.50, .50, .055, 64), silver, group, [0, .59, 0]);
  mesh(new THREE.CylinderGeometry(.50, .50, .06, 64), silver, group, [0, -.59, 0]);
  mesh(new THREE.TorusGeometry(.40, .038, 12, 64), silver, group, [0, .625, 0]).rotation.x = Math.PI / 2;
  const tab = mesh(new THREE.CapsuleGeometry(.065, .19, 4, 12), silver, group, [.13, .652, 0]);
  tab.rotation.x = Math.PI / 2; tab.rotation.z = -.4;
  const labelCanvas = document.createElement('canvas');labelCanvas.width = 512;labelCanvas.height = 360;
  const ink = labelCanvas.getContext('2d');
  ink.fillStyle = '#fff9e6';ink.beginPath();ink.roundRect(28, 25, 456, 310, 100);ink.fill();
  ink.fillStyle = '#178752';ink.font = '900 196px Arial';ink.textAlign = 'center';ink.textBaseline = 'middle';ink.fillText('HB', 256, 190);
  const label = new THREE.CanvasTexture(labelCanvas);label.colorSpace = THREE.SRGBColorSpace;
  const plane = mesh(new THREE.PlaneGeometry(.69, .49), new THREE.MeshBasicMaterial({ map: label, transparent: true, side: THREE.DoubleSide }), group, [0, .02, .49]);
  plane.rotation.y = 0;
  return group;
}

function makeEarth() {
  const group = new THREE.Group();
  const sea = new THREE.MeshPhysicalMaterial({ color: 0x58bde7, roughness: .28, metalness: .06, clearcoat: .45 });
  const land = new THREE.MeshStandardMaterial({ color: 0x70ba69, roughness: .55 });
  const cloud = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .72 });
  mesh(new THREE.SphereGeometry(.60, 48, 32), sea, group);
  const patches = [[-.28,.27,.49,.19,.13],[-.04,.35,.51,.15,.12],[.27,.14,.52,.17,.22],[.38,-.13,.46,.13,.18],[-.26,-.23,.49,.22,.12],[.02,-.34,.49,.15,.11]];
  patches.forEach(([x,y,z,sx,sy])=>{const part=mesh(new THREE.SphereGeometry(1,24,16), land, group, [x,y,z]);part.scale.set(sx,sy,.075);part.rotation.z=(x+y)*.8;});
  [[-.48,.48,.24],[-.28,.55,.18],[.43,.47,.28]].forEach(([x,y,z])=>mesh(new THREE.SphereGeometry(.095,18,12), cloud, group, [x,y,z]));
  return group;
}

function makeBell() {
  const group = new THREE.Group();
  const gold = new THREE.MeshPhysicalMaterial({ color: 0xffd42a, metalness: .46, roughness: .31, clearcoat: .25, side: THREE.DoubleSide });
  const inner = new THREE.MeshStandardMaterial({ color: 0xb87912, metalness: .55, roughness: .34 });
  const profile = [[.39,-.53],[.49,-.48],[.47,-.42],[.40,-.31],[.33,-.11],[.27,.20],[.17,.39],[.08,.48],[0,.49]].map(([r,y])=>new THREE.Vector2(r,y));
  mesh(new THREE.LatheGeometry(profile,64), gold, group);
  mesh(new THREE.TorusGeometry(.40,.06,12,64),gold,group,[0,-.50,0]).rotation.x = Math.PI/2;
  mesh(new THREE.TorusGeometry(.16,.07,12,48,Math.PI*1.6),gold,group,[0,.54,0]);
  mesh(new THREE.SphereGeometry(.12,24,16),inner,group,[0,-.57,0]);
  return group;
}

function makeMortar() {
  const group = new THREE.Group();
  const ceramic = new THREE.MeshPhysicalMaterial({ color: 0x1c2026, metalness: .22, roughness: .27, clearcoat: .32, side: THREE.DoubleSide });
  const dark = new THREE.MeshStandardMaterial({ color: 0x36383d, metalness: .3, roughness: .4 });
  const profile = [[0,-.45],[.26,-.45],[.42,-.33],[.53,-.06],[.59,.24],[.53,.32],[.46,.24],[.39,-.02],[.23,-.28],[0,-.33]].map(([r,y])=>new THREE.Vector2(r,y));
  mesh(new THREE.LatheGeometry(profile,64),ceramic,group);
  mesh(new THREE.TorusGeometry(.54,.058,12,64),ceramic,group,[0,.27,0]).rotation.x=Math.PI/2;
  const pestle = mesh(new THREE.CylinderGeometry(.095,.14,.70,32),dark,group,[.20,.27,.10]);pestle.rotation.z=-.43;
  mesh(new THREE.SphereGeometry(.14,24,16),dark,group,[.36,-.02,.10]);
  return group;
}

const previews = { can: makeCan, earth: makeEarth, bell: makeBell, mortar: makeMortar };

function disposeObject(object) {
  const seen = new Set();
  object.traverse(item=>{
    if(!item.isMesh)return;
    item.geometry?.dispose();
    for(const material of (Array.isArray(item.material)?item.material:[item.material])){
      if(!material || seen.has(material))continue;seen.add(material);
      for(const key of ['map','normalMap','roughnessMap','metalnessMap','emissiveMap'])material[key]?.dispose();
      material.dispose();
    }
  });
}

export default function SecondaryIcons({ active }) {
  const hostRef = useRef(null), activeRef = useRef(active);
  activeRef.current = active;
  useEffect(()=>{
    const host=hostRef.current;if(!host)return;
    let renderer,frame,disposed=false,elapsed=0,last=performance.now();
    const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,1000);
    // Icon dimensions are scaled to CSS pixels, including depth; keep the full
    // 3D volume inside the camera planes instead of slicing it into outlines.
    camera.position.z=400;
    try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,premultipliedAlpha:true});}catch{return;}
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
    renderer.setClearColor(0,0);host.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xffffff,0x9a927f,1.05));
    const key=new THREE.DirectionalLight(0xffffff,1.9);key.position.set(-2,4,5);scene.add(key);
    const fill=new THREE.DirectionalLight(0xffe6b0,.5);fill.position.set(3,-1,4);scene.add(fill);
    const pivots=icons.map(()=>{const pivot=new THREE.Group();scene.add(pivot);return pivot;});
    icons.forEach((item,index)=>{
      const pivot=pivots[index];
      const install=(object,source)=>{
        if(disposed){disposeObject(object);return;}
        pivot.clear();const bounds=new THREE.Box3().setFromObject(object);object.position.sub(bounds.getCenter(new THREE.Vector3()));
        const size=bounds.getSize(new THREE.Vector3());const wrap=new THREE.Group();wrap.add(object);pivot.add(wrap);
        pivot.userData={ source, wrap, maxDimension:Math.max(size.x,size.y,size.z),index,baseX:0,baseY:0 };
        host.dataset.modelSources=JSON.stringify(icons.map((icon,i)=>({id:icon.id,source:i===index?source:pivots[i]?.userData.source||'pending'})));
        layout();
      };
      if(item.url)new GLTFLoader().load(item.url,gltf=>install(gltf.scene,'lux3d'),undefined,()=>install(previews[item.id](),'local-preview'));
      else install(previews[item.id](),'local-preview');
    });
    // Each icon belongs to exactly one card (index-matched: can→AI 设计,
    // earth→视差滚动, bell→AI 博主, mortar→其他视频) and sits beside its own
    // card — never between two cards, never two on one card.
    const placements=[[-1,-.15],[1,-.3],[-1,.35],[1,.2]];
    function layout(){
      if(disposed||!renderer)return;
      const box=host.getBoundingClientRect(),width=host.clientWidth,height=host.clientHeight;
      if(width<1||height<1)return;
      camera.left=-width/2;camera.right=width/2;camera.top=height/2;camera.bottom=-height/2;camera.updateProjectionMatrix();renderer.setSize(width,height,false);
      const anchors=host.parentElement.querySelectorAll('.profile-cover-card');
      anchors.forEach((anchor,index)=>{
        const pivot=pivots[index];if(!pivot?.userData.wrap)return;
        const rect=anchor.querySelector('.profile-cover-image').getBoundingClientRect();
        const mobile=width<650;
        const iconSize=Math.min(rect.width*(mobile?.5:.5),mobile?80:170);
        pivot.userData.wrap.scale.setScalar(iconSize/pivot.userData.maxDimension);
        const [side,bias]=placements[index%placements.length];
        const cx=rect.left-box.left+rect.width/2-width/2;
        const cy=height/2-(rect.top-box.top+rect.height/2);
        let baseX=cx+side*(rect.width/2+iconSize*(mobile?.35:.55));
        let baseY=cy+bias*(rect.height/2+iconSize*.35);
        // Keep every icon fully inside the viewport (margin covers the float wobble).
        const margin=iconSize*.75;
        baseX=Math.max(-width/2+margin,Math.min(width/2-margin,baseX));
        baseY=Math.max(-height/2+margin,Math.min(height/2-margin,baseY));
        pivot.userData.baseX=baseX;
        pivot.userData.baseY=baseY;
        pivot.position.set(baseX,baseY,index%2?1:.7);
      });
    }
    const observer=new ResizeObserver(layout);observer.observe(host);
    host.parentElement.querySelectorAll('.profile-cover-image').forEach(item=>observer.observe(item));
    const wall=host.parentElement.querySelector('.profile-cover-wall');
    if(wall)observer.observe(wall);
    window.addEventListener('resize',layout);
    window.addEventListener('load',layout);
    // Re-anchor after fonts, covers and layout settle, so icons always
    // follow the cards even when the wall is repositioned by late CSS.
    const retryTimers=[300,900,2000].map(ms=>setTimeout(layout,ms));
    layout();
    function render(){
      frame=requestAnimationFrame(render);
      const now=performance.now();elapsed+=Math.min((now-last)/1000,.05);last=now;
      const moving=!matchMedia('(prefers-reduced-motion: reduce)').matches;
      pivots.forEach((pivot,index)=>{
        if(!pivot.userData.wrap)return;
        pivot.position.y=pivot.userData.baseY+(moving?Math.sin(elapsed*1.7+index*1.35)*7:0);
        pivot.rotation.y=(moving?Math.sin(elapsed*.75+index)*.22:.12);
        pivot.rotation.z=(moving?Math.sin(elapsed*1.12+index*2)*.075:0);
      });
      if(activeRef.current&&!document.hidden)renderer.render(scene,camera);
    }
    render();
    return()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('resize',layout);window.removeEventListener('load',layout);retryTimers.forEach(clearTimeout);pivots.forEach(disposeObject);renderer.dispose();renderer.domElement.remove();};
  },[]);
  return <div className="secondary-icons" ref={hostRef} aria-hidden="true" />;
}
