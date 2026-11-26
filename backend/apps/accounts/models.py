from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.core.exceptions import ValidationError
from django.db import models

from apps.common.uploads import upload_path
from apps.common.validators import normalize_phone, validate_image_file, validate_uz_phone


class Role(models.TextChoices):
    SUPERADMIN = "superadmin", "Platforma admini"
    DIRECTOR = "director", "Direktor"
    MANAGER = "manager", "Sotuv menejeri"
    CASHIER = "cashier", "Kassir"


COMPANY_ROLES = [Role.DIRECTOR, Role.MANAGER, Role.CASHIER]


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, phone, password, **extra):
        if not phone:
            raise ValueError("Telefon raqam majburiy")
        phone = normalize_phone(phone)
        user = self.model(phone=phone, **extra)
        user.set_password(password)
        user.full_clean(exclude=["password"])
        user.save(using=self._db)
        return user

    def create_user(self, phone, password=None, **extra):
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        extra.setdefault("role", Role.MANAGER)
        return self._create_user(phone, password, **extra)

    def create_superuser(self, phone, password=None, **extra):
        extra.update(is_staff=True, is_superuser=True, role=Role.SUPERADMIN, company=None)
        return self._create_user(phone, password, **extra)


class User(AbstractUser):
    """Tizim foydalanuvchisi. Login — telefon raqam orqali."""

    username = None
    phone = models.CharField(
        "telefon",
        max_length=13,
        unique=True,
        validators=[validate_uz_phone],
        help_text="+998XXXXXXXXX",
    )
    email = models.EmailField("email", blank=True)
    role = models.CharField("rol", max_length=20, choices=Role.choices, default=Role.MANAGER)
    company = models.ForeignKey(
        "companies.Company",
        verbose_name="kompaniya",
        on_delete=models.CASCADE,
        related_name="users",
        null=True,
        blank=True,
    )
    avatar = models.ImageField("rasm", upload_to=upload_path("users/avatars"), blank=True, validators=[validate_image_file])

    USERNAME_FIELD = "phone"
    REQUIRED_FIELDS = ["first_name"]

    objects = UserManager()

    class Meta:
        verbose_name = "foydalanuvchi"
        verbose_name_plural = "foydalanuvchilar"
        ordering = ["first_name", "last_name"]

    def __str__(self) -> str:
        return self.full_name or self.phone

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()

    def clean(self):
        super().clean()
        self.phone = normalize_phone(self.phone)
        if self.role == Role.SUPERADMIN and self.company_id:
            raise ValidationError({"company": "Platforma admini kompaniyaga biriktirilmaydi."})
        if self.role in COMPANY_ROLES and not self.company_id:
            raise ValidationError({"company": "Kompaniya xodimi kompaniyaga biriktirilishi shart."})
