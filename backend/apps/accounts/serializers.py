import logging

from django.conf import settings
from django.contrib.auth.models import update_last_login
from django.contrib.auth.password_validation import validate_password
from rest_framework import exceptions, serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenObtainSerializer
from rest_framework_simplejwt.settings import api_settings

from apps.common.validators import normalize_phone, validate_uz_phone
from apps.companies.serializers import CompanyShortSerializer

from .models import COMPANY_ROLES, Role, User
from .security import LoginGuard, client_ip, revoke_all_tokens

security_logger = logging.getLogger("kalit.security")


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    role_display = serializers.CharField(source="get_role_display", read_only=True)
    company = CompanyShortSerializer(read_only=True)

    class Meta:
        model = User
        fields = [
            "id", "phone", "first_name", "last_name", "full_name", "email", "avatar",
            "role", "role_display", "company", "is_active", "last_login", "date_joined",
        ]
        read_only_fields = fields


class MeUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["first_name", "last_name", "email", "avatar"]


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_old_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Joriy parol noto'g'ri.")
        return value

    def validate_new_password(self, value):
        validate_password(value, self.context["request"].user)
        return value


class LoginSerializer(TokenObtainPairSerializer):
    """Telefon + parol -> access/refresh token va foydalanuvchi ma'lumotlari.

    Xavfsizlik:
    - ketma-ket xato urinishlardan keyin telefon/IP vaqtincha bloklanadi;
    - kompaniya tekshiruvi token yaratilishidan OLDIN bajariladi;
    - xato xabari telefon mavjudligini oshkor qilmaydi.
    """

    default_error_messages = {
        "no_active_account": "Telefon raqam yoki parol noto'g'ri.",
    }

    def validate(self, attrs):
        phone = normalize_phone(attrs.get(self.username_field, ""))
        attrs[self.username_field] = phone
        request = self.context.get("request")
        guard = LoginGuard(phone, client_ip(request) if request else "")

        if guard.is_locked():
            raise exceptions.Throttled(
                detail=f"Juda ko'p noto'g'ri urinish. {settings.LOGIN_LOCKOUT_MINUTES} daqiqadan keyin qayta urinib ko'ring."
            )
        try:
            TokenObtainSerializer.validate(self, attrs)  # faqat autentifikatsiya, token yaratmaydi
        except exceptions.AuthenticationFailed:
            guard.register_failure()
            raise

        user = self.user
        if user.role != Role.SUPERADMIN:
            company = user.company
            if company is None or not company.is_usable:
                raise serializers.ValidationError(
                    {"detail": "Kompaniyangiz bloklangan yoki obuna muddati tugagan. Administrator bilan bog'laning."}
                )
        guard.reset()

        refresh = self.get_token(user)
        if api_settings.UPDATE_LAST_LOGIN:
            update_last_login(None, user)
        security_logger.info("Login: user=%s ip=%s", user.pk, guard.ip)
        return {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "user": UserSerializer(user, context=self.context).data,
        }

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["company_id"] = user.company_id
        return token


class EmployeeSerializer(serializers.ModelSerializer):
    """Direktor o'z kompaniyasi xodimlarini boshqaradi."""

    # Model validatorlaridan oldin normalizatsiya qilish uchun aniq e'lon qilingan
    phone = serializers.CharField(max_length=20)
    full_name = serializers.CharField(read_only=True)
    role_display = serializers.CharField(source="get_role_display", read_only=True)
    password = serializers.CharField(write_only=True, required=False, min_length=8)

    class Meta:
        model = User
        fields = [
            "id", "phone", "first_name", "last_name", "full_name", "email", "avatar",
            "role", "role_display", "is_active", "password", "last_login", "date_joined",
        ]
        read_only_fields = ["last_login", "date_joined"]

    def validate_phone(self, value):
        value = normalize_phone(value)
        try:
            validate_uz_phone(value)
        except Exception as exc:
            raise serializers.ValidationError(exc.messages)
        qs = User.objects.filter(phone=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Bu telefon raqam allaqachon ro'yxatdan o'tgan.")
        return value

    def validate_role(self, value):
        if value not in COMPANY_ROLES:
            raise serializers.ValidationError("Noto'g'ri rol.")
        return value

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate(self, attrs):
        request = self.context["request"]
        if self.instance is None:
            if not attrs.get("password"):
                raise serializers.ValidationError({"password": "Yangi xodim uchun parol majburiy."})
            company = request.user.company
            if company.users.filter(is_active=True).count() >= company.max_users:
                raise serializers.ValidationError(
                    {"detail": f"Tarifingiz bo'yicha xodimlar soni {company.max_users} tadan oshmasligi kerak."}
                )
        elif self.instance.pk == request.user.pk:
            # Direktor o'zini bloklab yoki rolini tushirib qo'ymasin
            if attrs.get("is_active") is False or attrs.get("role", self.instance.role) != self.instance.role:
                raise serializers.ValidationError({"detail": "O'z rolingizni yoki holatingizni o'zgartira olmaysiz."})
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        return User.objects.create_user(password=password, **validated_data)

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        old_role, was_active = instance.role, instance.is_active
        user = super().update(instance, validated_data)
        if password:
            user.set_password(password)
            user.save(update_fields=["password"])
        # Bloklangan, paroli yoki roli o'zgargan xodim sessiyalari darhol tugatiladi
        if password or (was_active and not user.is_active) or old_role != user.role:
            revoke_all_tokens(user)
        return user
