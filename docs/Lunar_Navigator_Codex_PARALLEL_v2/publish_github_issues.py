#!/usr/bin/env python3
"""Optional local helper. DRY RUN by default; --apply creates GitHub issues via gh CLI.
Only run with explicit authorization and a selected repository. Never run from Codex unprompted.
"""
import argparse, csv, pathlib, shutil, subprocess, sys
P = pathlib.Path(__file__).resolve().parent
parser=argparse.ArgumentParser(description='Preview or publish tasks as GitHub Issues')
parser.add_argument('--repo',required=True,help='GitHub owner/repo (e.g. organization/lunar-navigator)')
parser.add_argument('--apply',action='store_true',help='Actually create issues; default prints only')
parser.add_argument('--only',help='Optional task ID, e.g. BE-02')
parser.add_argument('--person',type=int,choices=range(1,6),help='Only the tasks of this participant number (1..5)')
args=parser.parse_args()
with (P/'issues.csv').open(encoding='utf-8',newline='') as f: tasks=list(csv.DictReader(f))
if args.person is not None:
    tasks=[r for r in tasks if int(r['assignee_number'])==args.person]
if args.only:
    tasks=[r for r in tasks if r['id']==args.only]
    if not tasks: sys.exit(f'No task found: {args.only}')
if args.apply and not shutil.which('gh'):sys.exit('gh CLI not found; install gh or use manual GitHub UI')
for r in tasks:
    body_file=P/r['body_file']
    cmd=['gh','issue','create','--repo',args.repo,'--title',r['id']+' — '+r['title'],'--body-file',str(body_file)]
    if args.apply:
        subprocess.run(cmd,check=True)
    else:
        print('DRY RUN:', ' '.join(cmd))
print(('Published' if args.apply else 'Would publish'), len(tasks), 'issues to',args.repo)
