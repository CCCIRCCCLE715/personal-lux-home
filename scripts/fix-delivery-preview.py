"""Repair the delivery viewer's reset control without changing its asset data."""

from pathlib import Path
import sys


preview = (Path(sys.argv[1]) if len(sys.argv) > 1 else
           Path(__file__).resolve().parents[1] / 'model/second-page/delivery/preview.html')
source = preview.read_text()
old_click = 'c.addEventListener("click",()=>Bf(l));'
new_click = 'c.addEventListener("click",()=>{l.controls.reset();Bf(l)});'
old_init = 'Bf(l),ph.push(l)'
new_init = 'Bf(l),l.controls.saveState(),ph.push(l)'
if old_click in source and old_init in source:
    source = source.replace(old_click, new_click, 1).replace(old_init, new_init, 1)
    preview.write_text(source)
    print('Delivery reset now restores saved initial camera and target')
elif new_click in source and new_init in source:
    print('Delivery reset patch already present')
else:
    raise RuntimeError('Unexpected viewer code; reset patch was not applied')
