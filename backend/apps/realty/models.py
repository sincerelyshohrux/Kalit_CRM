"""Ko'chmas mulk obyektlari: Loyiha (ЖК) -> Blok (bino) -> Kvartira (xonadon).

Pul qiymatlari so'mda, butun son (BigInteger) sifatida saqlanadi —
o'nli kasr xatolari bo'lmasligi uchun.
"""

from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.common.models import CompanyScopedModel
from apps.common.uploads import upload_path
from apps.common.validators import validate_image_file

MAX_FLOORS = 100
MAX_ENTRANCES = 20
MAX_UNITS_PER_FLOOR = 30


class Project(CompanyScopedModel):
    """Turar-joy majmuasi (ЖК)."""

    class Status(models.TextChoices):
        PLANNING = "planning", "Loyihalashtirilmoqda"
        CONSTRUCTION = "construction", "Qurilmoqda"
        COMPLETED = "completed", "Topshirilgan"

    class HousingClass(models.TextChoices):
        ECONOMY = "economy", "Ekonom"
        COMFORT = "comfort", "Komfort"
        BUSINESS = "business", "Biznes"
        PREMIUM = "premium", "Premium"

    name = models.CharField("nomi", max_length=200)
    city = models.CharField("shahar", max_length=100, blank=True)
    district = models.CharField("tuman", max_length=100, blank=True)
    address = models.CharField("manzil", max_length=255, blank=True)
    description = models.TextField("tavsif", blank=True)
    housing_class = models.CharField("sinf", max_length=20, choices=HousingClass.choices, default=HousingClass.COMFORT)
    status = models.CharField("holat", max_length=20, choices=Status.choices, default=Status.CONSTRUCTION)
    start_date = models.DateField("qurilish boshlangan", null=True, blank=True)
    completion_date = models.DateField("topshirish sanasi", null=True, blank=True)
    cover = models.ImageField("muqova", upload_to=upload_path("projects/covers"), blank=True, validators=[validate_image_file])
    is_active = models.BooleanField("sotuvda", default=True)

    class Meta:
        verbose_name = "loyiha"
        verbose_name_plural = "loyihalar"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["company", "name"], name="unique_project_name_per_company"),
        ]

    def __str__(self) -> str:
        return self.name


class Block(CompanyScopedModel):
    """Loyiha ichidagi bino (blok/korpus)."""

    project = models.ForeignKey(Project, verbose_name="loyiha", on_delete=models.CASCADE, related_name="blocks")
    name = models.CharField("nomi", max_length=50, help_text="Masalan: A blok, 2-korpus")
    floors_count = models.PositiveSmallIntegerField(
        "qavatlar soni", validators=[MinValueValidator(1), MaxValueValidator(MAX_FLOORS)]
    )
    entrances_count = models.PositiveSmallIntegerField(
        "podyezdlar soni", default=1, validators=[MinValueValidator(1), MaxValueValidator(MAX_ENTRANCES)]
    )
    units_per_floor = models.PositiveSmallIntegerField(
        "bir qavatdagi xonadonlar (har podyezdda)",
        validators=[MinValueValidator(1), MaxValueValidator(MAX_UNITS_PER_FLOOR)],
    )
    start_floor = models.SmallIntegerField(
        "turar-joy boshlanadigan qavat", default=1, validators=[MinValueValidator(-5), MaxValueValidator(MAX_FLOORS)]
    )
    completion_date = models.DateField("topshirish sanasi", null=True, blank=True)
    sort_order = models.PositiveSmallIntegerField("tartib", default=0)

    class Meta:
        verbose_name = "blok"
        verbose_name_plural = "bloklar"
        ordering = ["sort_order", "name"]
        constraints = [
            models.UniqueConstraint(fields=["project", "name"], name="unique_block_name_per_project"),
        ]

    def __str__(self) -> str:
        return f"{self.project.name} — {self.name}"

    @property
    def top_floor(self) -> int:
        return self.start_floor + self.floors_count - 1

    def save(self, *args, **kwargs):
        # Blok har doim loyiha bilan bir kompaniyada bo'ladi
        self.company_id = self.project.company_id
        super().save(*args, **kwargs)


class Unit(CompanyScopedModel):
    """Sotiladigan birlik: kvartira, tijorat xonasi, avtoturargoh, ombor."""

    class Status(models.TextChoices):
        AVAILABLE = "available", "Bo'sh"
        BOOKED = "booked", "Bron qilingan"
        SOLD = "sold", "Sotilgan"
        NOT_FOR_SALE = "not_for_sale", "Sotuvda emas"

    class UnitType(models.TextChoices):
        APARTMENT = "apartment", "Kvartira"
        COMMERCIAL = "commercial", "Tijorat"
        PARKING = "parking", "Avtoturargoh"
        STORAGE = "storage", "Ombor"

    class Finishing(models.TextChoices):
        NONE = "none", "Karobka"
        WHITE_BOX = "white_box", "Qora suvoq (white box)"
        FULL = "full", "Ta'mirli"

    # Qo'lda o'rnatish mumkin bo'lgan holatlar; bron/sotilgan faqat bron va shartnoma orqali
    MANUAL_STATUSES = {Status.AVAILABLE, Status.NOT_FOR_SALE}
    LOCKED_STATUSES = {Status.BOOKED, Status.SOLD}

    block = models.ForeignKey(Block, verbose_name="blok", on_delete=models.CASCADE, related_name="units")
    entrance = models.PositiveSmallIntegerField("podyezd", default=1)
    floor = models.SmallIntegerField("qavat")
    position = models.PositiveSmallIntegerField("qavatdagi o'rni", default=1)
    number = models.CharField("raqami", max_length=16)
    unit_type = models.CharField("turi", max_length=20, choices=UnitType.choices, default=UnitType.APARTMENT)
    rooms = models.PositiveSmallIntegerField("xonalar", default=1, validators=[MaxValueValidator(20)], help_text="0 — studiya")
    area = models.DecimalField(
        "maydon (m²)", max_digits=8, decimal_places=2,
        validators=[MinValueValidator(Decimal("1")), MaxValueValidator(Decimal("10000"))],
    )
    price_per_m2 = models.BigIntegerField("1 m² narxi (so'm)", validators=[MinValueValidator(0)])
    total_price = models.BigIntegerField("umumiy narx (so'm)", editable=False, default=0)
    status = models.CharField("holat", max_length=20, choices=Status.choices, default=Status.AVAILABLE, db_index=True)
    finishing = models.CharField("pardozlash", max_length=20, choices=Finishing.choices, default=Finishing.NONE)
    has_balcony = models.BooleanField("balkon", default=True)
    layout_image = models.ImageField(
        "planirovka", upload_to=upload_path("units/layouts"), blank=True, validators=[validate_image_file]
    )
    note = models.CharField("izoh", max_length=255, blank=True)

    class Meta:
        verbose_name = "xonadon"
        verbose_name_plural = "xonadonlar"
        ordering = ["block", "entrance", "-floor", "position"]
        constraints = [
            models.UniqueConstraint(fields=["block", "number"], name="unique_unit_number_per_block"),
            models.CheckConstraint(condition=models.Q(area__gt=0), name="unit_area_positive"),
            models.CheckConstraint(condition=models.Q(price_per_m2__gte=0), name="unit_price_non_negative"),
        ]
        indexes = [
            models.Index(fields=["company", "status"]),
            models.Index(fields=["block", "floor"]),
        ]

    def __str__(self) -> str:
        return f"{self.block} — №{self.number}"

    @staticmethod
    def calc_total(area, price_per_m2) -> int:
        return int((Decimal(area) * Decimal(price_per_m2)).quantize(Decimal("1"), rounding=ROUND_HALF_UP))

    def clean(self):
        super().clean()
        block = self.block
        if not (block.start_floor <= self.floor <= block.top_floor):
            raise ValidationError({"floor": f"Qavat {block.start_floor}–{block.top_floor} oralig'ida bo'lishi kerak."})
        if not (1 <= self.entrance <= block.entrances_count):
            raise ValidationError({"entrance": f"Podyezd 1–{block.entrances_count} oralig'ida bo'lishi kerak."})

    def save(self, *args, **kwargs):
        self.company_id = self.block.company_id
        self.total_price = self.calc_total(self.area, self.price_per_m2)
        update_fields = kwargs.get("update_fields")
        if update_fields is not None and ({"area", "price_per_m2"} & set(update_fields)):
            kwargs["update_fields"] = set(update_fields) | {"total_price"}
        super().save(*args, **kwargs)


class PriceChange(CompanyScopedModel):
    """Narx o'zgarishlari tarixi (kim, qachon, qanchadan qanchaga)."""

    unit = models.ForeignKey(Unit, verbose_name="xonadon", on_delete=models.CASCADE, related_name="price_changes")
    old_price_per_m2 = models.BigIntegerField("eski 1 m² narxi")
    new_price_per_m2 = models.BigIntegerField("yangi 1 m² narxi")
    old_total = models.BigIntegerField("eski umumiy narx")
    new_total = models.BigIntegerField("yangi umumiy narx")
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name="o'zgartirgan", on_delete=models.SET_NULL, null=True, related_name="+"
    )
    reason = models.CharField("sabab", max_length=255, blank=True)

    class Meta:
        verbose_name = "narx o'zgarishi"
        verbose_name_plural = "narx o'zgarishlari"
        ordering = ["-created_at"]
