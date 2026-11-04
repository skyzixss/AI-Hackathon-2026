"""Create an isolated PostgreSQL cluster; never connects to an existing database."""
import os, shutil, subprocess, tempfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]
os.chdir(root)
for binary in ['initdb','pg_ctl']:
    if not shutil.which(binary): raise SystemExit(f'{binary} required (PostgreSQL 17+). See docs/development.md.')
(root/'work').mkdir(exist_ok=True)
with tempfile.TemporaryDirectory(prefix='pg-',dir=root/'work') as directory:
    base=Path(directory); data=base/'data'; socket=base/'socket'; socket.mkdir()
    subprocess.run(['initdb','-D',str(data),'-U','postgres','--auth=trust','--no-locale'],check=True,stdout=subprocess.DEVNULL)
    started=False
    try:
        subprocess.run(['pg_ctl','-D',str(data),'-l',str(base/'postgres.log'),'-o',f"-h '' -k {socket} -p 55439",'-w','start'],check=True,stdout=subprocess.DEVNULL)
        started=True
        env={**os.environ,'TEST_PG_SOCKET':str(socket),'TEST_PG_PORT':'55439'}
        subprocess.run(['node','scripts/check-rls.mjs'],env=env,check=True)
    finally:
        if started: subprocess.run(['pg_ctl','-D',str(data),'-m','fast','-w','stop'],check=True,stdout=subprocess.DEVNULL)
