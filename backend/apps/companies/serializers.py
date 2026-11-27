from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from rest_framework import serializers

from apps.accounts.models import Role, User
from apps.common.validators import normalize_phone, validate_uz_phone

from .models import Company


class CompanyShortSerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = ["id", "name", "logo", "status", "plan", "subscription_until"]


class CompanySerializer(serializers.ModelSerializer):
    """Kompaniya paneli: direktor o'z kompaniyasi profilini ko'radi/tahrirlaydi."""

    users_count = serializers.SerializerMethodField()

    class Meta:
        model = Company
        fields = [
            "id", "name", "legal_name", "inn", "phone", "email", "city", "address", "logo",
            "status", "plan", "subscription_until", "max_users", "booking_days", "users_count", "created_at",
        ]
        # Tarif va holatni faqat platforma admini o'zgartiradi
        read_only_fields = ["status", "plan", "subscription_until", "max_users", "created_at"]

    def get_users_count(self, obj) -> int:
        return obj.users.filter(is_active=True).count()


class DirectorInputSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    phone = serializers.CharField(max_length=20)
    password = serializers.CharField(write_only=True, min_length=8)

    def validate_phone(self, value):
        value = normalize_phone(value)
        try:
            validate_uz_phone(value)
        except Exception as exc:  # django ValidationError -> DRF
            raise serializers.ValidationError(exc.messages)
        if User.objects.filter(phone=value).exists():
            raise serializers.ValidationError("Bu telefon raqam allaqachon ro'yxatdan o'tgan.")
        return value

    def validate_password(self, value):
        validate_password(value)
        return value


class PlatformCompanySerializer(serializers.ModelSerializer):
    """Platforma admin paneli: barcha maydonlar tahrirlanadi."""

    users_count = serializers.IntegerField(read_only=True)
    director = DirectorInputSerializer(write_only=True, required=False)
    director_info = serializers.SerializerMethodField()

    class Meta:
        model = Company
        fields = [
            "id", "name", "legal_name", "inn", "phone", "email", "city", "address", "logo",
            "status", "plan", "subscription_until", "max_users", "booking_days",
            "users_count", "director", "director_info", "created_at", "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def get_director_info(self, obj) -> dict | None:
        director = obj.users.filter(role=Role.DIRECTOR).order_by("date_joined").first()
        if not director:
            return None
        return {"id": director.id, "full_name": director.full_name, "phone": director.phone}

    def validate(self, attrs):
        if self.instance is None and "director" not in attrs:
            raise serializers.ValidationError({"director": "Yangi kompaniya uchun direktor ma'lumotlari majburiy."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        director_data = validated_data.pop("director")
        company = super().create(validated_data)
        password = director_data.pop("password")
        User.objects.create_user(
            password=password, company=company, role=Role.DIRECTOR, **director_data
        )
        return company

    def update(self, instance, validated_data):
        validated_data.pop("director", None)
        return super().update(instance, validated_data)
