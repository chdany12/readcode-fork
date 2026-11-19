from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator


class OrderLine(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    sku: str = Field(pattern=r"[A-Z0-9-]{4,20}")
    quantity: int = Field(ge=1, le=100)


class OrderIn(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    customer_ref: str = Field(pattern=r"^[A-Za-z0-9_-]{1,40}$")
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    coupon: str | None = Field(default=None, pattern=r"^[A-Z0-9]{4,12}$")
    lines: list[OrderLine] = Field(min_length=1, max_length=50)

    @field_validator("lines")
    @classmethod
    def no_duplicate_skus(cls, lines: list[OrderLine]) -> list[OrderLine]:
        seen: set[str] = set()
        for line in lines:
            if line.sku in seen:
                raise ValueError(f"duplicate sku {line.sku}")
            seen.add(line.sku)
        return lines
