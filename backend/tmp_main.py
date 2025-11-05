import sys
from uvicorn.main import main

sys.argv = ['uvicorn', 'app.main:app', '--reload']
try:
    main()
except Exception as exc:
    import traceback
    traceback.print_exc()
    raise
