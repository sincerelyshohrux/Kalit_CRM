import re

from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.common.models import TimeStampedModel

# Ilova marshrutlari bilan to'qnashmasligi uchun band qilingan manzillar
RESERVED_SLUGS = {
    "app", "platform", "login", "logout", "api", "admin", "media", "static", "assets", "www", "kalit",
    "help", "about", "settings", "docs", "auth", "public", "site", "sayt", "s", "u", "p", "favicon.ico",
    "robots.txt", "sitemap.xml", "manifest.json", "status", "support", "blog", "pricing", "register",
}
SLUG_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$")


def validate_site_slug(value: str) -> None:
    if not SLUG_RE.match(value or ""):
        raise ValidationError("3–40 belgi: kichik lotin harflari, raqamlar va chiziqcha (boshida/oxirida emas).")
    if value in RESERVED_SLUGS or "--" in value:
        raise ValidationError("Bu manzil band — boshqasini tanlang.")


TELEGRAM_RE = re.compile(r"^[A-Za-z0-9_]{5,32}$")
INSTAGRAM_RE = re.compile(r"^[A-Za-z0-9_.]{1,30}$")


def validate_telegram(value: str) -> None:
    if value and not TELEGRAM_RE.match(value):
        raise ValidationError("Telegram username: 5–32 belgi, @ belgisisiz.")


def validate_instagram(value: str) -> None:
    if value and not INSTAGRAM_RE.match(value):
        raise ValidationError("Instagram username: 1–30 belgi, @ belgisisiz.")


class SiteSettings(TimeStampedModel):
    """Kompaniyaning ommaviy sayti: `kalit.uz/<slug>`. Direktor boshqaradi."""

    company = models.OneToOneField(
        "companies.Company", verbose_name="kompaniya", on_delete=models.CASCADE, related_name="site"
    )
    slug = models.CharField("manzil", max_length=40, unique=True, validators=[validate_site_slug])
    is_enabled = models.BooleanField("sayt yoqilgan", default=False)
    show_prices = models.BooleanField("narxlarni ko'rsatish", default=True)
    headline = models.CharField("sarlavha", max_length=120, blank=True)
    about = models.TextField("kompaniya haqida", max_length=1500, blank=True)
    phone = models.CharField("aloqa telefoni", max_length=13, blank=True)
    telegram = models.CharField("Telegram", max_length=32, blank=True, validators=[validate_telegram])
    instagram = models.CharField("Instagram", max_length=30, blank=True, validators=[validate_instagram])
    # Bo'lib to'lash (rassrochka) kalkulyatori
    installment_enabled = models.BooleanField("bo'lib to'lash", default=True)
    installment_min_down = models.PositiveSmallIntegerField(
        "minimal boshlang'ich to'lov (%)", default=30, validators=[MinValueValidator(0), MaxValueValidator(90)]
    )
    installment_max_months = models.PositiveSmallIntegerField(
        "maksimal muddat (oy)", default=24, validators=[MinValueValidator(1), MaxValueValidator(120)]
    )
    installment_markup = models.DecimalField(
        "bo'lib to'lash ustamasi (%)", max_digits=5, decimal_places=2, default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text="Qolgan summaga qo'shiladigan umumiy foiz (0 — ustamasiz)",
    )

    class Meta:
        verbose_name = "sayt sozlamalari"
        verbose_name_plural = "sayt sozlamalari"

    def __str__(self) -> str:
        return self.slug
