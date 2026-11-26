"""Web-klient uchun refresh tokenni httpOnly cookie'da saqlash.

Brauzer (React) `X-Kalit-Client: web` sarlavhasini yuboradi:
- refresh token JSON javobga qo'shilmaydi, faqat httpOnly cookie'ga yoziladi —
  JavaScript (va XSS) uni o'qiy olmaydi;
- access token faqat xotirada (memory) saqlanadi;
- cookie SameSite=Strict va faqat `/api/v1/auth/` yo'liga yuboriladi.
- Maxsus sarlavha talab qilingani uchun boshqa saytdan CSRF hujumi bilan
  refresh/logout chaqirib bo'lmaydi (oddiy forma sarlavha qo'sha olmaydi).

Mobil ilova va boshqa API klientlar avvalgidek JSON'dagi refresh bilan ishlaydi.
"""

from django.conf import settings

COOKIE_NAME = "kalit_refresh"
COOKIE_PATH = "/api/v1/auth/"
CLIENT_HEADER = "HTTP_X_KALIT_CLIENT"


def is_web_client(request) -> bool:
    return request.META.get(CLIENT_HEADER) == "web"


def set_refresh_cookie(response, refresh: str) -> None:
    response.set_cookie(
        COOKIE_NAME,
        refresh,
        max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
        httponly=True,
        secure=not settings.DEBUG,
        samesite="Strict",
        path=COOKIE_PATH,
    )


def clear_refresh_cookie(response) -> None:
    response.delete_cookie(COOKIE_NAME, path=COOKIE_PATH, samesite="Strict")


def get_refresh(request) -> str | None:
    if is_web_client(request):
        return request.COOKIES.get(COOKIE_NAME)
    return request.data.get("refresh")
