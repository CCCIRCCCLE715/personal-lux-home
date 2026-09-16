"""Query original Lux3D icon task IDs and download successful ZIP+GLB outputs."""

import datetime as dt
import json
import os
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'model/second-page'
SKILL = Path('/Users/huangshaoshuai/.codex/plugins/cache/openai-curated-remote/aholo-lux3d/0.1.1/skills/lux3d')
sys.path.insert(0, str(SKILL / 'core/runtime'))
from lux3d_client import (get_task, generation_result_formats, parse_task_outputs,
                          download_requested_models)  # noqa: E402


def save(path, value):
    temp = path.with_suffix(path.suffix + '.tmp')
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2))
    temp.replace(path)


def main():
    config = json.loads((Path.home() / '.config/lux3d/credentials.json').read_text())
    os.environ['LUX3D_CN_API_KEY'] = config['apiKeys']['cn']
    for name in ['can', 'earth', 'bell', 'mortar']:
        path = OUT / f'{name}-attempt.json'
        record = json.loads(path.read_text())
        if not record.get('taskId'):
            print(f'{name}: no task ID; will not submit again')
            continue
        if record.get('downloadedArtifacts'):
            print(f'{name}: already downloaded')
            continue
        try:
            data = get_task(record['taskId'], region='cn')
        except Exception as error:
            print(f'{name}: query issue ({type(error).__name__}); original task retained')
            continue
        status = data['status']
        record['providerStatus'] = status
        record['updatedAt'] = dt.datetime.now(dt.timezone.utc).isoformat()
        save(path, record)
        print(f'{name}: task {record["taskId"]} status {status}')
        if status != 3:
            continue
        expected = generation_result_formats(record['parameters']['version'],
                                             record['parameters']['outputFormat'])
        artifact_dir = OUT / 'originals' / name
        artifact_dir.mkdir(parents=True, exist_ok=True)
        try:
            urls = parse_task_outputs(data)
            files = download_requested_models(urls, str(artifact_dir / name), expected)
        except Exception as error:
            record['downloadErrorType'] = type(error).__name__
            save(path, record)
            print(f'{name}: output download issue ({type(error).__name__}); will resume original ID')
            continue
        record['downloadedArtifacts'] = [
            {'path': str(Path(file).resolve()), 'bytes': size, 'format': fmt}
            for (file, size), fmt in zip(files, expected)
        ]
        record['localCompletedAt'] = dt.datetime.now(dt.timezone.utc).isoformat()
        save(path, record)
        print(f'{name}: ZIP+GLB originals saved')


if __name__ == '__main__':
    main()
