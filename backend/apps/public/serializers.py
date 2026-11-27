import re

from rest_framework import serializers

from apps.crm.serializers import clean_phone
from apps.realty.models import Project, Unit

from .models import SiteSettings, validate_instagram, validate_telegram


def run(validator, value):
    from django.core.exceptions import ValidationError as DjangoValidationError

    try:
        validator(value)
    except DjangoValidationError as exc:
        raise serializers.ValidationError(exc.messages)
    return value

# Ism: harflar (lotin/kirill), bo'shliq, apostrof va chiziqcha. Havola/HTML yuborib bo'lmaydi.
NAME_RE = re.compile(r"^[A-Za-zА-Яа-яЁёЎўҚқҒғҲҳʻʼ'`‘’\- ]{1,80}$")
URL_RE = re.compile(r"(https?://|www\.|\.(com|ru|uz|net|org)\b)", re.I)


def clean_name(value: str, required: bool) -> str:
    value = " ".join((value or "").split())
    if not value:
        if required:
            raise serializers.ValidationError("Ismingizni yozing.")
        return ""
    if not NAME_RE.match(value):
        raise serializers.ValidationError("Faqat harflardan iborat bo'lsin.")
    return value


class LeadSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=80)
    last_name = serializers.CharField(max_length=80, required=False, allow_blank=True, default="")
    phone = serializers.CharField(max_length=25)
    project = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    unit = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    message = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")
    # Honeypot — haqiqiy foydalanuvchi ko'rmaydi va to'ldirmaydi
    website = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    # Cloudflare Turnstile tokeni
    token = serializers.CharField(max_length=2048, required=False, allow_blank=True, default="")

    def validate_first_name(self, value):
        return clean_name(value, required=True)

    def validate_last_name(self, value):
        return clean_name(value, required=False)

    def validate_phone(self, value):
        return clean_phone(value)

    def validate_message(self, value):
        value = value.strip()
        if URL_RE.search(value):
            raise serializers.ValidationError("Xabarda havola yuborib bo'lmaydi.")
        return value

    def validate(self, attrs):
        projects = self.context["projects"]
        if attrs.get("unit"):
            unit = Unit.objects.select_related("block", "block__project").filter(block__project__in=projects, pk=attrs["unit"]).first()
            if unit is None:
                raise serializers.ValidationError({"unit": "Xonadon topilmadi."})
            attrs["unit"] = unit
            attrs["project"] = None
        elif attrs.get("project"):
            project = projects.filter(pk=attrs["project"]).first()
            if project is None:
                raise serializers.ValidationError({"project": "Loyiha topilmadi."})
            attrs["project"] = project
        return attrs


class SiteSettingsSerializer(serializers.ModelSerializer):
    """Kompaniya paneli: direktor sayt sozlamalarini boshqaradi."""

    url = serializers.SerializerMethodField()
    projects = serializers.SerializerMethodField()
    # "@" va bo'shliqlarni olib tashlash model validatorlaridan oldin bajarilishi uchun
    phone = serializers.CharField(max_length=25, required=False, allow_blank=True)
    telegram = serializers.CharField(max_length=40, required=False, allow_blank=True)
    instagram = serializers.CharField(max_length=40, required=False, allow_blank=True)

    class Meta:
        model = SiteSettings
        fields = [
            "slug", "is_enabled", "show_prices", "headline", "about", "phone", "telegram", "instagram",
            "installment_enabled", "installment_min_down", "installment_max_months", "installment_markup",
            "url", "projects", "updated_at",
        ]
        read_only_fields = ["updated_at"]

    def get_url(self, obj) -> str:
        from django.conf import settings

        return f"{settings.PUBLIC_BASE_URL}/{obj.slug}"

    def get_projects(self, obj) -> list[dict]:
        return [
            {"id": p.id, "name": p.name, "is_active": p.is_active, "show_on_site": p.show_on_site}
            for p in Project.objects.filter(company=obj.company).order_by("name")
        ]

    def validate_slug(self, value):
        value = value.strip().lower()
        qs = SiteSettings.objects.filter(slug=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Bu manzil boshqa kompaniyada band.")
        return value

    def validate_phone(self, value):
        return clean_phone(value) if value else ""

    def validate_telegram(self, value):
        value = value.strip().lstrip("@")
        return run(validate_telegram, value)

    def validate_instagram(self, value):
        value = value.strip().lstrip("@")
        return run(validate_instagram, value)
