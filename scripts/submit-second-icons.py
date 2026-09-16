"""Submit the approved four-icon Lux3D batch once, preserving every task ID."""

import datetime as dt
import json
import os
from pathlib import Path
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]
SKILL = Path('/Users/huangshaoshuai/.codex/plugins/cache/openai-curated-remote/aholo-lux3d/0.1.1/skills/lux3d')
RUNTIME = SKILL / 'core/runtime'
sys.path.insert(0, str(RUNTIME))
from lux3d_client import create_text_to_3d_task  # noqa: E402

OUT = ROOT / 'model/second-page'
ITEMS = json.loads((OUT / 'icons-quote-items.json').read_text())
IDS = {'1': 'can', '2': 'earth', '3': 'bell', '4': 'mortar'}
APPROVAL = 'User approved the quoted four-icon batch at 80 credits on 2026-09-15.'


def write_json(path, value):
    temp = path.with_suffix(path.suffix + '.tmp')
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2))
    temp.replace(path)


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def quote():
    cmd = [sys.executable, str(SKILL / 'scripts/commerce.py'), 'quote',
           '--region', 'cn', '--items', str(OUT / 'icons-quote-items.json')]
    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if result.returncode:
        raise RuntimeError(result.stderr.strip() or 'Lux3D quote failed')
    value = json.loads(result.stdout)
    account, price = value['account'], value['quote']
    if account['region'] != 'cn' or price['estimatedCreditsTotal'] != 80:
        raise RuntimeError('Account, region or approved batch price changed')
    if price['details'] != {key: 20 for key in IDS}:
        raise RuntimeError('Approved model prices changed')
    expiry = dt.datetime.fromisoformat(price['expiresAt'])
    context_expiry = dt.datetime.fromisoformat(account['uniqueIdExpiresAt'])
    if min(expiry, context_expiry) <= dt.datetime.now(dt.timezone.utc):
        raise RuntimeError('Quote or account context already expired')
    if account['availableCredits'] < 80:
        raise RuntimeError('Insufficient Lux3D balance for approved batch')
    write_json(OUT / 'icons-quote.json', value)
    return value


def main():
    config = json.loads((Path.home() / '.config/lux3d/credentials.json').read_text())
    os.environ['LUX3D_CN_API_KEY'] = config['apiKeys']['cn']
    current = quote()
    price = current['quote']
    ledger_path = OUT / 'icons-ledger.json'
    ledger = json.loads(ledger_path.read_text()) if ledger_path.exists() else {
        'region': 'cn', 'approvedCredits': 80, 'committedCredits': 0,
        'approval': APPROVAL, 'items': {},
    }
    for index, name in IDS.items():
        path = OUT / f'{name}-attempt.json'
        if path.exists():
            existing = json.loads(path.read_text())
            if existing.get('taskId'):
                print(f'{name}: existing task {existing["taskId"]}; no duplicate submission')
                continue
            if existing.get('submissionState') != 'not-submitted':
                raise RuntimeError(f'{name}: prior uncertain submission; reconcile before retry')
        body = ITEMS[index]['parameters']['body']
        record = {
            'asset': name, 'region': 'cn', 'accountRef': current['account']['accountRef'],
            'operation': 'text-to-3d', 'parameters': body,
            'quoteId': price['quoteId'], 'approvedCredits': 20, 'approval': APPROVAL,
            'retryCount': 0, 'submissionState': 'started',
            'startedAt': now(), 'taskId': None, 'providerStatus': None,
        }
        write_json(path, record)
        ledger['committedCredits'] += 20
        ledger['items'][name] = {'credits': 20, 'submission': 'started', 'quoteId': price['quoteId']}
        write_json(ledger_path, ledger)
        try:
            task_id = create_text_to_3d_task(region='cn', **body)
        except Exception as error:
            record['submissionState'] = 'uncertain'
            record['submissionErrorType'] = type(error).__name__
            record['updatedAt'] = now()
            write_json(path, record)
            print(f'{name}: submission outcome uncertain; no automatic resubmission', file=sys.stderr)
            raise
        record['taskId'] = task_id
        record['submissionState'] = 'submitted'
        record['updatedAt'] = now()
        write_json(path, record)
        ledger['items'][name].update(submission='submitted', taskId=task_id)
        write_json(ledger_path, ledger)
        print(f'{name}: Lux3D task {task_id} submitted')
    print(f'Approved allowance committed: {ledger["committedCredits"]}/80 credits')


if __name__ == '__main__':
    main()
