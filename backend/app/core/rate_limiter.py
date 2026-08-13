import time
from collections import defaultdict


class RateLimiter:

    def __init__(
        self,
        max_requests: int = 20,
        window_seconds: int = 60,
    ):
        self.max_requests = max_requests
        self.window_seconds = window_seconds

        self.requests = defaultdict(list)

    def check(self, user_id: int):

        now = time.time()

        user_requests = self.requests[user_id]

        # Remove expired requests
        user_requests[:] = [
            request_time
            for request_time in user_requests
            if now - request_time < self.window_seconds
        ]

        # Check limit
        if len(user_requests) >= self.max_requests:
            return False

        # Record request
        user_requests.append(now)

        return True


rag_rate_limiter = RateLimiter(
    max_requests=20,
    window_seconds=60,
)