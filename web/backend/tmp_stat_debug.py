import logging
import uvicorn
from uvicorn.supervisors.statreload import StatReload

class DebugStatReload(StatReload):
    def startup(self):
        print('startup begin', flush=True)
        return super().startup()

    def __init__(self, *args, **kwargs):
        print('init start', flush=True)
        super().__init__(*args, **kwargs)
        print('init done', flush=True)

config = uvicorn.Config('app.main:app', reload=True)
server = uvicorn.Server(config=config)
sock = config.bind_socket()
reloader = DebugStatReload(config, target=server.run, sockets=[sock])
print('created reloader; running', flush=True)
try:
    reloader.run()
except Exception as exc:
    import traceback
    traceback.print_exc()
    raise
