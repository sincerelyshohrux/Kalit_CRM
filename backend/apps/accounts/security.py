"""Login xavfsizligi: brute-force himoyasi va tokenlarni bekor qilish."""

import hashlib
import logging

from django.conf import settings
from django.core.cache import cache
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

logger = logging.getLogger("kalit.security")


def client_ip(request) -> str:
    # Productionda nginx X-Forwarded-For'ni to'g'ri o'rnatishi kerak; ishonchli proxy ortida ishlaydi.
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "")


def _key(kind: str, value: str) -> str:
    return "login-fail:%s:%s" % (kind, hashlib.sha256(value.encode()).hexdigest()[:32])


class LoginGuard:
    """Ketma-ket noto'g'ri urinishlardan keyin telefon raqamni va IP'ni vaqtincha bloklaydi.

    Telefon bo'yicha: LOGIN_MAX_ATTEMPTS ta xato -> LOGIN_LOCKOUT_MINUTES daqiqa blok.
    IP bo'yicha: 4 baravar ko'proq urinishga ruxsat (bitta ofisdan ko'p xodim kirishi mumkin).
    """

    def __init__(self, phone: str, ip: str):
        self.phone_key = _key("phone", phone or "")
        self.ip_key = _key("ip", ip or "")
        self.max = settings.LOGIN_MAX_ATTEMPTS
        self.ttl = settings.LOGIN_LOCKOUT_MINUTES * 60
        self.phone, self.ip = phone, ip

    def is_locked(self) -> bool:
        return (cache.get(self.phone_key, 0) >= self.max) or (cache.get(self.ip_key, 0) >= self.max * 4)

    def register_failure(self) -> None:
        for key in (self.phone_key, self.ip_key):
            cache.add(key, 0, self.ttl)
            try:
                cache.incr(key)
            except ValueError:
                cache.set(key, 1, self.ttl)
        logger.warning("Login xato: phone=%s ip=%s", mask_phone(self.phone), self.ip)

    def reset(self) -> None:
        cache.delete(self.phone_key)


def mask_phone(phone: str) -> str:
    return (phone[:6] + "***" + phone[-2:]) if phone and len(phone) > 8 else "***"


def revoke_all_tokens(user) -> int:
    """Foydalanuvchining barcha refresh tokenlarini bekor qiladi (parol almashganda, bloklanganda)."""
    count = 0
    for token in OutstandingToken.objects.filter(user=user).exclude(blacklistedtoken__isnull=False):
        BlacklistedToken.objects.get_or_create(token=token)
        count += 1
    return count
