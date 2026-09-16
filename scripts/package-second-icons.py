"""Build a Lux3D delivery preview from the original four generated assets."""

import json
from pathlib import Path
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'model/second-page'
SKILL = Path('/Users/huangshaoshuai/.codex/plugins/cache/openai-curated-remote/aholo-lux3d/0.1.1/skills/lux3d')
LABELS = {
    'can': '绿色 HB 汽水罐', 'earth': 'Q 版小地球',
    'bell': '黄色通知铃铛', 'mortar': '黑色药碗与研杵',
}


def save(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2))


def main():
    items = []
    for name, label in LABELS.items():
        attempt_path = OUT / f'{name}-attempt.json'
        attempt = json.loads(attempt_path.read_text())
        assert attempt['providerStatus'] == 3 and attempt.get('downloadedArtifacts')
        artifacts = attempt['downloadedArtifacts']
        assert [part['format'] for part in artifacts] == ['zip', 'glb']
        assert all(Path(part['path']).is_file() and Path(part['path']).stat().st_size == part['bytes']
                   for part in artifacts)
        selected = f'{name}-generation'
        state_path = OUT / f'{name}-delivery-state.json'
        save(state_path, {
            'schema': 'lux3d.workflow-state/v2', 'taskId': attempt['taskId'],
            'status': 'succeeded', 'lastKnownProviderStatus': 3,
            'request': {'operation': 'text-to-3d', 'region': 'cn', 'version': 'G1'},
            'expectedFormats': ['zip', 'glb'],
            'downloadedArtifacts': [{'path': part['path'], 'format': part['format']}
                                    for part in artifacts],
            'createdAt': attempt['startedAt'], 'updatedAt': attempt['updatedAt'],
            'localCompletedAt': attempt['localCompletedAt'],
        })
        attempt['qualityStatus'] = ('accepted-with-website-degenerate-cleanup'
                                    if name in ('can', 'mortar') else 'accepted-volumetric')
        attempt['websiteModel'] = str(ROOT / 'public/models' / f'{name}-lux3d.glb')
        save(attempt_path, attempt)
        items.append({'id': name, 'label': label, 'selectedAttemptId': selected,
                      'attempts': [{'id': selected, 'statePath': str(state_path)}]})
    spec_path = OUT / 'delivery-spec.json'
    save(spec_path, {'schema': 'lux3d.delivery-spec/v2',
                     'title': '黄白第二页 · 四个 LUX 3D Q 版卡通图标',
                     'items': items, 'scene': {'status': 'not-requested'}})
    delivery_dir = OUT / 'delivery-v2'
    command = [sys.executable, str(SKILL / 'core/runtime/delivery_bundle.py'),
               'prepare', '--spec', str(spec_path),
               '--output-dir', str(delivery_dir), '--locale', 'zh-CN']
    subprocess.run(command, check=True)
    subprocess.run([sys.executable, str(ROOT / 'scripts/fix-delivery-preview.py'),
                    str(delivery_dir / 'preview.html')], check=True)
    print('Four original Lux3D assets packaged in one offline preview')


if __name__ == '__main__':
    main()
