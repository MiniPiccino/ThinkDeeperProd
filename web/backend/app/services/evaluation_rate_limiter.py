from __future__ import annotations

from collections import defaultdict, deque
from threading import BoundedSemaphore, Lock
from time import monotonic
from typing import Callable, Deque


class EvaluationRateLimitError(RuntimeError):
    """Raised before provider work when a bounded evaluation budget is exhausted."""


class EvaluationRateLimiter:
    def __init__(
        self,
        user_limit: int,
        global_limit: int,
        max_concurrency: int,
        clock: Callable[[], float] = monotonic,
    ) -> None:
        self._user_limit = max(1, user_limit)
        self._global_limit = max(1, global_limit)
        self._clock = clock
        self._lock = Lock()
        self._users: dict[str, Deque[float]] = defaultdict(deque)
        self._global: Deque[float] = deque()
        self._slots = BoundedSemaphore(max(1, max_concurrency))

    def acquire(self, user_id: str) -> None:
        now = self._clock()
        with self._lock:
            self._prune(self._global, now - 60)
            user = self._users[user_id]
            self._prune(user, now - 300)
            if len(user) >= self._user_limit or len(self._global) >= self._global_limit:
                raise EvaluationRateLimitError("Evaluation rate limit exceeded")
            if not self._slots.acquire(blocking=False):
                raise EvaluationRateLimitError("Evaluation capacity is busy")
            user.append(now)
            self._global.append(now)

    def release(self) -> None:
        self._slots.release()

    @staticmethod
    def _prune(values: Deque[float], cutoff: float) -> None:
        while values and values[0] <= cutoff:
            values.popleft()
