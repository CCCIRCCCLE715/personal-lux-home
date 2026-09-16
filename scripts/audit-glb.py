"""Measure downloaded GLB geometry without modifying the original asset."""
import json, struct, sys
from pathlib import Path
import numpy as np

def inspect(path):
    data=Path(path).read_bytes(); offset=12; doc=None; binary=None
    while offset<len(data):
        length,kind=struct.unpack_from('<II',data,offset); chunk=data[offset+8:offset+8+length];offset+=length+8
        if kind==0x4e4f534a:doc=json.loads(chunk)
        elif kind==0x004e4942:binary=chunk
    def accessor(index):
        a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']]
        dtype={5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']]
        width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];size=np.dtype(dtype).itemsize
        return np.ndarray((a['count'],width),dtype=dtype,buffer=binary,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',size*width),size)).copy()
    reports=[]
    for mesh in doc.get('meshes',[]):
        for prim in mesh['primitives']:
            if prim.get('mode',4)!=4:continue
            p=accessor(prim['attributes']['POSITION']).astype(float)
            idx=accessor(prim['indices']).ravel().reshape(-1,3) if 'indices' in prim else np.arange(len(p)).reshape(-1,3)
            area=np.linalg.norm(np.cross(p[idx[:,1]]-p[idx[:,0]],p[idx[:,2]]-p[idx[:,0]]),axis=1)
            dimensions=np.ptp(p,axis=0)
            normal=accessor(prim['attributes']['NORMAL']) if 'NORMAL' in prim['attributes'] else None
            reports.append({'vertices':len(p),'triangles':len(idx),'localDimensions':dimensions.tolist(),'minToMaxExtentRatio':float(min(dimensions)/max(dimensions)),'finitePositions':bool(np.isfinite(p).all()),'finiteNormals':None if normal is None else bool(np.isfinite(normal).all()),'zeroAreaTriangles':int(np.count_nonzero(area<1e-14))})
    return {'file':str(Path(path).resolve()),'geometry':reports,'materials':doc.get('materials',[]),'note':'Geometry checks do not establish visual acceptance or scene-space collision clearance.'}
if __name__=='__main__':print(json.dumps([inspect(p) for p in sys.argv[1:]],ensure_ascii=False,indent=2))
