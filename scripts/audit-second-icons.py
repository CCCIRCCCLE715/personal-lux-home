"""Check Lux3D icon originals for broken GLB/ZIP data and degenerate faces."""

import json
from pathlib import Path
import struct
import zipfile

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'model/second-page'
TYPES = {5121: 'u1', 5123: '<u2', 5125: '<u4', 5126: '<f4'}
WIDTHS = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}


def glb(path):
    data = path.read_bytes()
    assert data[:4] == b'glTF' and struct.unpack_from('<I', data, 4)[0] == 2
    cursor, document, binary = 12, None, None
    while cursor < len(data):
        length, kind = struct.unpack_from('<II', data, cursor)
        payload = data[cursor+8:cursor+8+length]
        if kind == 0x4E4F534A: document = json.loads(payload)
        if kind == 0x004E4942: binary = payload
        cursor += length + 8
    assert document is not None and binary is not None

    def read(index):
        accessor = document['accessors'][index]
        view = document['bufferViews'][accessor['bufferView']]
        kind = np.dtype(TYPES[accessor['componentType']])
        width = WIDTHS[accessor['type']]
        step = view.get('byteStride', kind.itemsize * width)
        start = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
        return np.ndarray((accessor['count'], width), dtype=kind, buffer=binary,
                          offset=start, strides=(step, kind.itemsize)).copy()

    triangles = degenerate = invalid_indices = nan_values = 0
    for item in document['meshes']:
        for primitive in item['primitives']:
            positions = read(primitive['attributes']['POSITION']).astype(np.float64)
            nan_values += int(np.count_nonzero(~np.isfinite(positions)))
            if 'NORMAL' in primitive['attributes']:
                nan_values += int(np.count_nonzero(~np.isfinite(read(primitive['attributes']['NORMAL']))))
            if primitive.get('mode', 4) != 4 or 'indices' not in primitive:
                continue
            indices = read(primitive['indices']).ravel()
            invalid_indices += int(np.count_nonzero(indices >= len(positions)))
            faces = indices.reshape(-1, 3)
            triangles += len(faces)
            cross = np.cross(positions[faces[:,1]]-positions[faces[:,0]],
                             positions[faces[:,2]]-positions[faces[:,0]])
            degenerate += int(np.count_nonzero(np.linalg.norm(cross, axis=1) < 1e-12))
    return {'glbBytes': len(data), 'triangles': triangles, 'degenerateTriangles': degenerate,
            'invalidIndices': invalid_indices, 'nonFiniteComponents': nan_values,
            'materials': len(document.get('materials', []))}


def main():
    report = {}
    for name in ['can', 'earth', 'bell', 'mortar']:
        original = OUT / 'originals' / name
        with zipfile.ZipFile(original / f'{name}_zip.zip') as archive:
            models = [item for item in archive.namelist() if item.lower().endswith('.glb')]
            corrupt = archive.testzip()
        result = glb(original / f'{name}_glb.glb')
        website = glb(ROOT / 'public/models' / f'{name}-lux3d.glb')
        result.update(zipModelEntries=models, zipFirstCorruptEntry=corrupt,
                      originalClean=(corrupt is None and len(models) > 0 and
                                     result['invalidIndices'] == 0 and result['nonFiniteComponents'] == 0 and
                                     result['degenerateTriangles'] == 0),
                      website=website,
                      websiteClean=(website['invalidIndices'] == 0 and
                                    website['nonFiniteComponents'] == 0 and
                                    website['degenerateTriangles'] == 0))
        report[name] = result
        print(f'{name}: {result["triangles"]} triangles, '
              f'{result["degenerateTriangles"]} degenerate, '
              f'{result["invalidIndices"]} invalid indices, '
              f'website degenerate {website["degenerateTriangles"]}, '
              f'ZIP {"OK" if corrupt is None else "CORRUPT"}')
    (OUT / 'geometry-audit.json').write_text(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
