import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Temporary, locally modeled 3D previews. NOT Lux3D-generated deliverables.
// Replace these groups with GLB assets through modelSlots.js after intake.
const mat=(color,roughness=.45,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
const mesh=(geometry,material)=>new THREE.Mesh(geometry,material);
function box(w,h,d,r,material){return mesh(new RoundedBoxGeometry(w,h,d,3,r),material);}
function shapeMesh(shape,depth,material,bevel=.04){const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSegments:4,steps:1,bevelSize:bevel,bevelThickness:bevel,curveSegments:32});g.translate(0,0,-depth/2);return mesh(g,material);}
function roundedRect(x,y,w,h,r){const s=new THREE.Shape();s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;}
function tube(points,r,material){return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),48,r,8,false),material);}
function palette(){const group=new THREE.Group(),wood=mat('#c89865',.6);const s=new THREE.Shape();s.moveTo(.4,-.43);s.bezierCurveTo(-.1,-.73,-.72,-.32,-.56,.22);s.bezierCurveTo(-.35,.79,.26,.72,.55,.28);s.bezierCurveTo(.76,-.05,.54,-.17,.36,-.06);s.bezierCurveTo(.12,.08,.02,-.16,.24,-.29);s.bezierCurveTo(.33,-.32,.46,-.32,.4,-.43);const hole=new THREE.Path();hole.absellipse(.05,-.23,.095,.12,0,Math.PI*2,true,0);s.holes.push(hole);group.add(shapeMesh(s,.085,wood,.025));const colors=['#ef534e','#ffcf20','#5599e7','#9571d5','#43ae73'];const points=[[-.26,.4],[.06,.46],[.35,.29],[-.42,.13],[-.34,-.2]];points.forEach(([x,y],i)=>{const paint=mesh(new THREE.SphereGeometry(.096,20,12),mat(colors[i],.22));paint.scale.set(1,.85,.35);paint.position.set(x,y,.084);group.add(paint);});return group;}
function banknotes(){const group=new THREE.Group();for(let i=0;i<6;i++){const bill=box(1,.045,.47,.009,mat(i%2?'#9ad4a2':'#5bb777',.88));bill.position.y=i*.054;bill.rotation.y=(i-3)*.018;group.add(bill);}const top=box(.89,.012,.36,.008,mat('#35975d',.85));top.position.set(0,.31,0);group.add(top);const band=box(.2,.365,.493,.015,mat('#f5e9c8',.8));band.position.y=.15;group.add(band);const circle=mesh(new THREE.CylinderGeometry(.09,.09,.01,24),mat('#89c793',.8));circle.position.set(-.28,.325,0);group.add(circle);group.rotation.x=.6;group.rotation.z=-.14;return group;}
function terminal(){const group=new THREE.Group();group.add(box(.95,.95,.18,.14,mat('#171b1e',.29,.23)));const screen=box(.83,.8,.024,.09,mat('#22292c',.3));screen.position.set(0,-.01,.103);group.add(screen);const white=mat('#f8fff9',.27);group.add(tube([[-.23,.15,.137],[-.05,0,.137],[-.23,-.15,.137]],.034,white));group.add(tube([[.05,-.15,.137],[.26,-.15,.137]],.031,white));['#f96c62','#f7d157','#87c77d'].forEach((c,i)=>{const dot=mesh(new THREE.SphereGeometry(.027,12,8),mat(c,.25));dot.scale.z=.3;dot.position.set(-.28+i*.095,.31,.133);group.add(dot);});return group;}
function brain(){const g=new THREE.Group();const pink=mat('#ed8fbd',.38);for(const side of [-1,1]){const lobe=mesh(new THREE.SphereGeometry(.34,24,18),pink);lobe.scale.set(.79,1, .83);lobe.position.x=side*.21;g.add(lobe);for(let j=0;j<5;j++){const points=[];for(let i=0;i<=24;i++){const t=i/24;const a=(t-.5)*Math.PI*1.27;const y=(j-2)*.108+.035*Math.sin(t*Math.PI*3+j);const x=side*(.21+.235*Math.sin(a));const z=.24*Math.cos(a)*Math.sqrt(Math.max(.1,1-(y/.38)**2));points.push([x,y,z]);}g.add(tube(points,.048,pink));}}return g;}
function glasses(){const g=new THREE.Group(),black=mat('#111517',.2,.12);for(const side of [-1,1]){const x=side<0?-.58:.08;const outer=roundedRect(x,-.19,.5,.4,.105);const inner=roundedRect(x+.045,-.14,.41,.30,.082);outer.holes.push(new THREE.Path(inner.getPoints(48)));g.add(shapeMesh(outer,.05,black,.012));const lens=shapeMesh(roundedRect(x+.05,-.135,.4,.29,.07),.006,new THREE.MeshPhysicalMaterial({color:'#e8f1ee',roughness:.03,transparent:true,opacity:.18,metalness:0}),.003);lens.position.z=.01;g.add(lens);const arm=tube([[side*.57,.09,0],[side*.57,.13,-.32],[side*.45,.01,-.57]],.025,black);g.add(arm);}g.add(tube([[-.085,.095,.02],[0,.12,.02],[.085,.095,.02]],.026,black));return g;}
// Closed inflated surfaces: curved fronts, backs and silhouette, no flat extrusion.
function inflated(shape,depth,material){
  const outline=shape.getSpacedPoints(192);outline.pop();
  if(THREE.ShapeUtils.isClockWise(outline))outline.reverse();
  const n=outline.length,rings=48,positions=[0,0,depth],indices=[];
  for(let j=1;j<rings;j++){
    const latitude=Math.PI*j/rings,scale=Math.sin(latitude),z=depth*Math.cos(latitude);
    for(const point of outline)positions.push(point.x*scale,point.y*scale,z);
  }
  const bottom=positions.length/3;positions.push(0,0,-depth);
  for(let i=0;i<n;i++){
    const next=(i+1)%n;indices.push(0,1+i,1+next);
    for(let j=0;j<rings-2;j++){
      const a=1+j*n+i,b=1+j*n+next,c=a+n,d=b+n;
      indices.push(a,c,b,b,c,d);
    }
    indices.push(bottom,1+(rings-2)*n+next,1+(rings-2)*n+i);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  return mesh(geometry,material);
}
function heart(){
  const s=new THREE.Shape();s.moveTo(0,-.46);
  s.bezierCurveTo(-.14,-.32,-.57,-.02,-.5,.27);
  s.bezierCurveTo(-.45,.58,-.13,.55,0,.29);
  s.bezierCurveTo(.13,.55,.45,.58,.5,.27);
  s.bezierCurveTo(.57,-.02,.14,-.32,0,-.46);
  return inflated(s,.30,mat('#f3424e',.24));
}
function star(){
  const points=Array.from({length:10},(_,i)=>{
    const angle=Math.PI/2+i*Math.PI/5,r=i%2?.265:.54;
    return new THREE.Vector2(Math.cos(angle)*r,Math.sin(angle)*r);
  });
  const s=new THREE.Shape(),start=points[9].clone().lerp(points[0],.5);s.moveTo(start.x,start.y);
  points.forEach((p,i)=>{const end=p.clone().lerp(points[(i+1)%10],.5);s.quadraticCurveTo(p.x,p.y,end.x,end.y);});
  s.closePath();return inflated(s,.24,mat('#ffd91e',.27,.03));
}
export const previewFactories={palette,banknotes,terminal,brain,glasses,heart,star};
export function releaseObject(root){const geometries=new Set(),materials=new Set(),textures=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:[o.material]).filter(Boolean)){materials.add(m);Object.values(m).forEach(v=>{if(v?.isTexture)textures.add(v);});}});textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());}
