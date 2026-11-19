import threading
from dataclasses import dataclass, field


class CapacityError(Exception):
    pass


@dataclass
class RunnerPool:
    name: str
    capacity: int
    in_use: int = 0
    lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    def available(self) -> int:
        return self.capacity - self.in_use

    def reserve(self, slots: int) -> None:
        with self.lock:
            if slots > self.available():
                raise CapacityError(f"{self.name}: need {slots}, have {self.available()}")
            self.in_use += slots

    def release(self, slots: int) -> None:
        with self.lock:
            self.in_use = max(0, self.in_use - slots)
