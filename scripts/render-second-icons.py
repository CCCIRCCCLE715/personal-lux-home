"""Blender quality renders for inspecting Lux3D originals; invoked headlessly."""

import bpy
from mathutils import Vector
from pathlib import Path
import sys


name = sys.argv[-1]
root = Path(__file__).resolve().parents[1]
source = root / 'model/second-page/originals' / name / f'{name}_glb.glb'
out = root / 'model/second-page/quality' / f'{name}.png'
out.parent.mkdir(parents=True, exist_ok=True)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source))
meshes = [item for item in bpy.context.scene.objects if item.type == 'MESH']
if not meshes:
    raise RuntimeError('GLB has no importable mesh')
points = [item.matrix_world @ Vector(corner) for item in meshes for corner in item.bound_box]
low = Vector(tuple(min(point[index] for point in points) for index in range(3)))
high = Vector(tuple(max(point[index] for point in points) for index in range(3)))
center = (low + high) / 2
size = max((high - low).x, (high - low).y, (high - low).z)

world = bpy.context.scene.world
world.color = (.9, .9, .9)
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (.93, .92, .89, 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = .55

def area(label, location, energy, dimension):
    data = bpy.data.lights.new(label, 'AREA')
    data.energy = energy
    data.shape = 'DISK'
    data.size = dimension
    obj = bpy.data.objects.new(label, data)
    bpy.context.collection.objects.link(obj)
    obj.location = center + Vector(location) * size
    obj.rotation_euler = (center - obj.location).to_track_quat('-Z', 'Y').to_euler()

# Lux3D output uses compact physical units. Keep illuminance stable across
# models of different sizes instead of blowing out centimeter-scale objects.
power_scale = (size / 2) ** 2
area('large softbox', (-1.8, -2.3, 3), 650 * power_scale, size * 2)
area('rim light', (2.4, 1.8, 2), 350 * power_scale, size * 1.8)

camera_data = bpy.data.cameras.new('quality camera')
camera = bpy.data.objects.new('quality camera', camera_data)
bpy.context.collection.objects.link(camera)
camera.location = center + Vector((1.35, -2.6, 1.65)) * size
camera.rotation_euler = (center - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera_data.type = 'ORTHO'
camera_data.ortho_scale = size * 1.65
bpy.context.scene.camera = camera

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 48
scene.render.resolution_x = scene.render.resolution_y = 768
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(out)
bpy.ops.render.render(write_still=True)
print(f'{name}: {len(meshes)} meshes, bounds {tuple(round(v, 3) for v in high-low)}, render {out}')
