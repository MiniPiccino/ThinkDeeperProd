import logging
import uvicorn

logging.basicConfig(level='DEBUG')

config = uvicorn.Config('app.main:app', reload=True)
server = uvicorn.Server(config)
server.run()
