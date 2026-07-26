import os, subprocess, re, sys
out = subprocess.check_output(['netstat','-ano','-p','tcp'], text=True)
lines = [line for line in out.splitlines() if ':8000' in line and 'LISTENING' in line]
print('\n'.join(lines))
pids = sorted({re.split(r'\s+', line.strip())[-1] for line in lines if line})
print('pids', pids)
for pid in pids:
    try:
        subprocess.run(['taskkill','/F','/PID',pid], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=False)
        print('killed', pid)
    except Exception as exc:
        print('failed', pid, exc)
