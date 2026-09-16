"""Preserve source GLB; remove zero-area faces and calibrate matte toy material."""
import json,struct,sys
from pathlib import Path
import numpy as np
name=sys.argv[1];source=Path(f'model/round-assets/{name}-standard/{name}_glb.glb');data=source.read_bytes();offset=12
while offset<len(data):
 length,kind=struct.unpack_from('<II',data,offset);chunk=data[offset+8:offset+8+length];offset+=length+8
 if kind==0x4e4f534a:doc=json.loads(chunk)
 elif kind==0x004e4942:binary=bytearray(chunk)
def read(index):
 a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']];dt={5121:'u1',5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']];w={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];size=np.dtype(dt).itemsize
 return np.ndarray((a['count'],w),dtype=dt,buffer=binary,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',size*w),size)).copy()
removed=0
for mesh in doc['meshes']:
 for prim in mesh['primitives']:
  if prim.get('mode',4)!=4 or 'indices' not in prim:continue
  p=read(prim['attributes']['POSITION']).astype(float);indices=read(prim['indices']).ravel().reshape(-1,3)
  area=np.linalg.norm(np.cross(p[indices[:,1]]-p[indices[:,0]],p[indices[:,2]]-p[indices[:,0]]),axis=1);keep=area>=1e-14;count=int(np.count_nonzero(~keep));removed+=count
  if not count:continue
  clean=indices[keep].astype('<u4').ravel();binary.extend(b'\0'*((-len(binary))%4));start=len(binary);binary.extend(clean.tobytes());vi=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':start,'byteLength':clean.nbytes,'target':34963});ai=len(doc['accessors']);doc['accessors'].append({'bufferView':vi,'componentType':5125,'count':len(clean),'type':'SCALAR','min':[int(clean.min())],'max':[int(clean.max())]});prim['indices']=ai
for material in doc['materials']:
 pbr=material.setdefault('pbrMetallicRoughness',{});pbr['metallicFactor']=0;pbr['roughnessFactor']={'brain':.63,'heart':.33,'star':.42}[name];pbr.pop('metallicRoughnessTexture',None)
 material['name']=name+' — calibrated silicone'
doc['buffers'][0]['byteLength']=len(binary);js=json.dumps(doc,separators=(',',':')).encode();js+=b' '*((-len(js))%4);binary.extend(b'\0'*((-len(binary))%4));out=struct.pack('<4sII',b'glTF',2,28+len(js)+len(binary))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(binary),0x004e4942)+binary
path=Path(f'public/models/{name}-lux3d-standard.glb');path.write_bytes(out)
record={'source':str(source),'output':str(path),'removedZeroAreaFaces':removed,'materialChanges':'non-metallic silicone; roughness calibrated; base color and normal texture preserved','geometryReshaped':False}
Path(f'model/round-assets/{name}-standard/local-adjustments.json').write_text(json.dumps(record,indent=2));print(json.dumps(record))
