import re

from django.core.exceptions import ValidationError

UZ_PHONE_RE = re.compile(r"^\+998\d{9}$")


def normalize_phone(value: str) -> str:
    """'90 123-45-67', '998901234567', '+998 (90) 123 45 67' -> '+998901234567'."""
    if not value:
        return value
    digits = re.sub(r"\D", "", value)
    if len(digits) == 9:
        digits = "998" + digits
    return "+" + digits


def validate_uz_phone(value: str) -> None:
    if not UZ_PHONE_RE.match(value or ""):
        raise ValidationError("Telefon raqam +998XXXXXXXXX formatida bo'lishi kerak.")


def validate_inn(value: str) -> None:
    if value and not re.fullmatch(r"\d{9}", value):
        raise ValidationError("STIR 9 ta raqamdan iborat bo'lishi kerak.")
