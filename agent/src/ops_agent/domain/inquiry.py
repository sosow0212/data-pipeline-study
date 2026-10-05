import re
from dataclasses import dataclass
from datetime import date


class UnknownServiceError(ValueError):
    pass


class ModelNotConfiguredError(RuntimeError):
    pass


@dataclass(frozen=True)
class Inquiry:
    service_id: str
    day: date
    question: str
    environment: str = "production"

    def __post_init__(self):
        if not re.fullmatch(r"[a-z][a-z0-9-]{1,63}", self.service_id):
            raise ValueError("invalid service_id")
        if not 1 <= len(self.question.strip()) <= 2000:
            raise ValueError("question must have 1 to 2000 characters")
        if self.environment not in {"production", "staging"}:
            raise ValueError("invalid environment")
