"""Tune Lux3D bell color for its sunny Q-icon role; preserve source GLB."""

import json
from pathlib import Path
import struct


root = Path(__file__).resolve().parents[1]
source = root / 'model/second-page/originals/bell/bell_glb.glb'
target = root / 'public/models/bell-lux3d.glb'
data = source.read_bytes()
cursor = 12
chunks = []
while cursor < len(data):
    length, kind = struct.unpack_from('<II', data, cursor)
    payload = data[cursor + 8:cursor + 8 + length]
    chunks.append((kind, payload))
    cursor += 8 + length
assert len(chunks) == 2 and chunks[0][0] == 0x4E4F534A
doc = json.loads(chunks[0][1])
for material in doc['materials']:
    pbr = material['pbrMetallicRoughness']
    pbr['baseColorFactor'] = [1, .92, .25, 1]
    pbr['metallicFactor'] = .15
    pbr['roughnessFactor'] = .38
    pbr.pop('metallicRoughnessTexture', None)
    material['name'] = 'Lux3D bell — saturated yellow enamel calibration'
encoded = json.dumps(doc, separators=(',', ':')).encode()
encoded += b' ' * ((-len(encoded)) % 4)
body = struct.pack('<II', len(encoded), 0x4E4F534A) + encoded
for kind, payload in chunks[1:]:
    body += struct.pack('<II', len(payload), kind) + payload
target.write_bytes(struct.pack('<4sII', b'glTF', 2, len(body) + 12) + body)
(root / 'model/second-page/bell-local-adjustment.json').write_text(json.dumps({
    'original': str(source), 'websiteModel': str(target),
    'geometryChanged': False,
    'material': 'Base color tint toward saturated sunny yellow; satin enamel roughness; original base-color texture preserved',
}, ensure_ascii=False, indent=2))
print(f'Calibrated bell color; original preserved: {target}')
