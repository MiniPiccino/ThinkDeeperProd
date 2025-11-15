import multiprocessing as mp
import time

def run():
    time.sleep(0.1)

if __name__ == '__main__':
    ctx = mp.get_context('spawn')
    p = ctx.Process(target=run)
    p.start()
    p.join()
    print('ok')
