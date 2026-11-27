from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.common.models import CompanyScopedModel
from apps.common.validators import normalize_phone, validate_uz_phone

MAX_BUDGET = 1_000_000_000_000  # 1 trln so'm — mantiqiy yuqori chegara


class Client(CompanyScopedModel):
    """Mijoz (lid). Bitta kompaniya ichida telefon raqam takrorlanmaydi."""

    class Source(models.TextChoices):
        INSTAGRAM = "instagram", "Instagram"
        TELEGRAM = "telegram", "Telegram"
        REFERRAL = "referral", "Tanish-bilish"
        OFFICE = "office", "Ofisga keldi"
        CALL = "call", "Qo'ng'iroq"
        WEBSITE = "website", "Sayt"
        OTHER = "other", "Boshqa"

    class Status(models.TextChoices):
        NEW = "new", "Yangi"
        CONTACTED = "contacted", "Bog'lanildi"
        VISITED = "visited", "Ko'rishga keldi"
        BOOKED = "booked", "Bron"
        CONTRACT = "contract", "Shartnoma"
        REJECTED = "rejected", "Rad etdi"

    # Qo'lda o'rnatiladigan holatlar; bron va shartnoma — faqat tegishli modullar orqali
    MANUAL_STATUSES = {Status.NEW, Status.CONTACTED, Status.VISITED, Status.REJECTED}
    AUTO_STATUSES = {Status.BOOKED, Status.CONTRACT}

    last_name = models.CharField("familiya", max_length=80, blank=True)
    first_name = models.CharField("ism", max_length=80)
    middle_name = models.CharField("otasining ismi", max_length=80, blank=True)
    phone = models.CharField("telefon", max_length=13, validators=[validate_uz_phone])
    phone2 = models.CharField("qo'shimcha telefon", max_length=13, blank=True, validators=[validate_uz_phone])
    source = models.CharField("manba", max_length=20, choices=Source.choices, default=Source.OFFICE)
    status = models.CharField("holat", max_length=20, choices=Status.choices, default=Status.NEW, db_index=True)
    reject_reason = models.CharField("rad etish sababi", max_length=255, blank=True)
    manager = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name="mas'ul menejer", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="clients",
    )
    interested_project = models.ForeignKey(
        "realty.Project", verbose_name="qiziqqan loyiha", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="interested_clients",
    )
    budget = models.BigIntegerField(
        "byudjet (so'm)", null=True, blank=True, validators=[MinValueValidator(0), MaxValueValidator(MAX_BUDGET)]
    )
    note = models.TextField("izoh", max_length=2000, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name="kiritgan", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="+",
    )

    class Meta:
        verbose_name = "mijoz"
        verbose_name_plural = "mijozlar"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["company", "phone"], name="unique_client_phone_per_company"),
        ]
        indexes = [
            models.Index(fields=["company", "status"]),
            models.Index(fields=["company", "manager"]),
        ]

    def __str__(self) -> str:
        return self.full_name

    @property
    def full_name(self) -> str:
        return " ".join(p for p in (self.last_name, self.first_name, self.middle_name) if p).strip()

    def save(self, *args, **kwargs):
        self.phone = normalize_phone(self.phone)
        if self.phone2:
            self.phone2 = normalize_phone(self.phone2)
        super().save(*args, **kwargs)


class ClientActivity(CompanyScopedModel):
    """Mijoz tarixi: izohlar, qo'ng'iroqlar, holat o'zgarishlari, bron hodisalari."""

    class Kind(models.TextChoices):
        CREATED = "created", "Bazaga qo'shildi"
        NOTE = "note", "Izoh"
        CALL = "call", "Qo'ng'iroq"
        MEETING = "meeting", "Uchrashuv"
        STATUS = "status", "Holat o'zgardi"
        MANAGER = "manager", "Menejer o'zgardi"
        BOOKING_CREATED = "booking_created", "Bron qilindi"
        BOOKING_EXTENDED = "booking_extended", "Bron uzaytirildi"
        BOOKING_CANCELLED = "booking_cancelled", "Bron bekor qilindi"
        BOOKING_EXPIRED = "booking_expired", "Bron muddati tugadi"
        WEBSITE = "website", "Saytdan ariza"

    # Foydalanuvchi qo'lda qo'sha oladigan turlar
    MANUAL_KINDS = {Kind.NOTE, Kind.CALL, Kind.MEETING}

    client = models.ForeignKey(Client, verbose_name="mijoz", on_delete=models.CASCADE, related_name="activities")
    kind = models.CharField("turi", max_length=30, choices=Kind.choices)
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name="muallif", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    text = models.CharField("matn", max_length=1000, blank=True)
    booking = models.ForeignKey(
        "Booking", verbose_name="bron", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )

    class Meta:
        verbose_name = "mijoz faoliyati"
        verbose_name_plural = "mijoz faoliyati"
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["client", "-created_at"])]

    def __str__(self) -> str:
        return f"{self.client} — {self.get_kind_display()}"


class Booking(CompanyScopedModel):
    """Xonadon broni. Bitta xonadonda bir vaqtda faqat bitta faol bron bo'ladi (DB darajasida)."""

    class Status(models.TextChoices):
        ACTIVE = "active", "Faol"
        EXPIRED = "expired", "Muddati tugagan"
        CANCELLED = "cancelled", "Bekor qilingan"
        CONVERTED = "converted", "Shartnomaga o'tgan"

    unit = models.ForeignKey("realty.Unit", verbose_name="xonadon", on_delete=models.CASCADE, related_name="bookings")
    client = models.ForeignKey(Client, verbose_name="mijoz", on_delete=models.PROTECT, related_name="bookings")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name="bron qilgan", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="+",
    )
    status = models.CharField("holat", max_length=20, choices=Status.choices, default=Status.ACTIVE, db_index=True)
    expires_at = models.DateTimeField("amal qilish muddati")
    # Bron paytidagi narx (keyin narx o'zgarsa ham mijozga aytilgan narx saqlanadi)
    price_per_m2 = models.BigIntegerField("1 m² narxi (so'm)")
    total_price = models.BigIntegerField("umumiy narx (so'm)")
    note = models.CharField("izoh", max_length=500, blank=True)
    closed_at = models.DateTimeField("yopilgan vaqt", null=True, blank=True)
    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name="yopgan", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    cancel_reason = models.CharField("bekor qilish sababi", max_length=255, blank=True)

    class Meta:
        verbose_name = "bron"
        verbose_name_plural = "bronlar"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["unit"], condition=models.Q(status="active"), name="one_active_booking_per_unit"
            ),
        ]
        indexes = [models.Index(fields=["company", "status", "expires_at"])]

    def __str__(self) -> str:
        return f"Bron #{self.pk} — {self.unit}"


class Notification(CompanyScopedModel):
    """Xodimga ichki bildirishnoma (saytdan ariza va h.k.)."""

    class Kind(models.TextChoices):
        LEAD = "lead", "Yangi ariza"
        LEAD_REPEAT = "lead_repeat", "Takroriy ariza"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name="xodim", on_delete=models.CASCADE, related_name="notifications"
    )
    kind = models.CharField("turi", max_length=30, choices=Kind.choices)
    title = models.CharField("sarlavha", max_length=200)
    text = models.CharField("matn", max_length=500, blank=True)
    client = models.ForeignKey(Client, verbose_name="mijoz", on_delete=models.CASCADE, null=True, blank=True, related_name="+")
    read_at = models.DateTimeField("o'qilgan", null=True, blank=True)

    class Meta:
        verbose_name = "bildirishnoma"
        verbose_name_plural = "bildirishnomalar"
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["user", "read_at"])]

    def __str__(self) -> str:
        return self.title
