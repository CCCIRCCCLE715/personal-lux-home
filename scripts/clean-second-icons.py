"""Remove zero-area triangles from site GLBs; keep untouched Lux3D originals."""

import json
from pathlib import Path
import struct

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
TYPES = {5121: 'u1', 5123: '<u2', 5125: '<u4', 5126: '<f4'}
WIDTHS = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}


def clean(name):
    source = ROOT / 'model/second-page/originals' / name / f'{name}_glb.glb'
    target = ROOT / 'public/models' / f'{name}-lux3d.glb'
    data = source.read_bytes()
    cursor, doc, binary = 12, None, None
    while cursor < len(data):
        length, kind = struct.unpack_from('<II', data, cursor)
        payload = data[cursor+8:cursor+8+length]
        if kind == 0x4E4F534A: doc = json.loads(payload)
        if kind == 0x004E4942: binary = bytearray(payload)
        cursor += length + 8
    assert doc and binary is not None

    def read(index):
        accessor = doc['accessors'][index]
        view = doc['bufferViews'][accessor['bufferView']]
        dtype = np.dtype(TYPES[accessor['componentType']])
        width = WIDTHS[accessor['type']]
        step = view.get('byteStride', dtype.itemsize * width)
        offset = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
        return np.ndarray((accessor['count'], width), dtype=dtype, buffer=binary,
                          offset=offset, strides=(step, dtype.itemsize)).copy()

    removed = 0
    for item in doc['meshes']:
        for primitive in item['primitives']:
            if primitive.get('mode', 4) != 4 or 'indices' not in primitive:
                continue
            positions = read(primitive['attributes']['POSITION']).astype(np.float64)
            faces = read(primitive['indices']).ravel().reshape(-1, 3)
            vectors = np.cross(positions[faces[:,1]]-positions[faces[:,0]],
                               positions[faces[:,2]]-positions[faces[:,0]])
            good = np.linalg.norm(vectors, axis=1) >= 1e-12
            count = int(np.count_nonzero(~good))
            removed += count
            if not count:
                continue
            indices = faces[good].astype('<u4').ravel()
            binary.extend(b'\0' * ((-len(binary)) % 4))
            start = len(binary)
            binary.extend(indices.tobytes())
            view_index = len(doc['bufferViews'])
            doc['bufferViews'].append({'buffer': 0, 'byteOffset': start,
                                       'byteLength': indices.nbytes, 'target': 34963})
            accessor_index = len(doc['accessors'])
            doc['accessors'].append({'bufferView': view_index, 'componentType': 5125,
                                     'count': len(indices), 'type': 'SCALAR',
                                     'min': [int(indices.min())], 'max': [int(indices.max())]})
            primitive['indices'] = accessor_index
    binary.extend(b'\0' * ((-len(binary)) % 4))
    doc['buffers'][0]['byteLength'] = len(binary)
    encoded = json.dumps(doc, separators=(',', ':')).encode()
    encoded += b' ' * ((-len(encoded)) % 4)
    body = (struct.pack('<II', len(encoded), 0x4E4F534A) + encoded +
            struct.pack('<II', len(binary), 0x004E4942) + binary)
    target.write_bytes(struct.pack('<4sII', b'glTF', 2, len(body) + 12) + body)
    record = {'source': str(source), 'websiteModel': str(target),
              'removedZeroAreaTriangles': removed, 'geometryReshaped': False,
              'materialChanges': None}
    (ROOT / 'model/second-page' / f'{name}-local-adjustment.json').write_text(
        json.dumps(record, indent=2))
    print(f'{name}: removed {removed} zero-area triangles from website copy')


for icon in ['can', 'mortar']:
    clean(icon)
