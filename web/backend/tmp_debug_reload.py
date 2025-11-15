import logging
import multiprocessing
import uvicorn
from uvicorn.supervisors import ChangeReload

multiprocessing.set_start_method('fork')

config = uvicorn.Config('app.main:app', reload=True)
server = uvicorn.Server(config=config)
sock = config.bind_socket()
try:
    ChangeReload(config, target=server.run, sockets=[sock]).run()
except Exception as exc:
    import traceback
    traceback.print_exc()
    raise
