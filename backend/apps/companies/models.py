from django.db import models
from django.utils import timezone

from apps.common.models import TimeStampedModel
from apps.common.uploads import upload_path
from apps.common.validators import validate_image_file, validate_inn


class Company(TimeStampedModel):
    """Qurilish kompaniyasi (zastroyshik) — platformadagi tenant."""

    class Status(models.TextChoices):
        ACTIVE = "active", "Faol"
        SUSPENDED = "suspended", "Bloklangan"

    class Plan(models.TextChoices):
        TRIAL = "trial", "Sinov"
        START = "start", "Start"
        BUSINESS = "business", "Business"
        ENTERPRISE = "enterprise", "Enterprise"

    name = models.CharField("nomi", max_length=200)
    legal_name = models.CharField("yuridik nomi", max_length=255, blank=True)
    inn = models.CharField("STIR", max_length=9, blank=True, validators=[validate_inn])
    phone = models.CharField("telefon", max_length=20, blank=True)
    email = models.EmailField("email", blank=True)
    city = models.CharField("shahar", max_length=100, blank=True)
    address = models.CharField("manzil", max_length=255, blank=True)
    logo = models.ImageField("logotip", upload_to=upload_path("companies/logos"), blank=True, validators=[validate_image_file])

    status = models.CharField("holat", max_length=20, choices=Status.choices, default=Status.ACTIVE)
    plan = models.CharField("tarif", max_length=20, choices=Plan.choices, default=Plan.TRIAL)
    subscription_until = models.DateField("obuna muddati", null=True, blank=True)
    max_users = models.PositiveIntegerField("maksimal xodimlar", default=10)

    class Meta:
        verbose_name = "kompaniya"
        verbose_name_plural = "kompaniyalar"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["inn"],
                condition=~models.Q(inn=""),
                name="unique_company_inn",
            )
        ]

    def __str__(self) -> str:
        return self.name

    @property
    def is_subscription_active(self) -> bool:
        return self.subscription_until is None or self.subscription_until >= timezone.localdate()

    @property
    def is_usable(self) -> bool:
        """Kompaniya xodimlari tizimdan foydalana oladimi."""
        return self.status == self.Status.ACTIVE and self.is_subscription_active
