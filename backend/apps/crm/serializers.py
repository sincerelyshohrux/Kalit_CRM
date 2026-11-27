from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.accounts.models import Role, User
from apps.common.fields import CompanyScopedPrimaryKeyRelatedField
from apps.common.validators import normalize_phone, validate_uz_phone
from apps.realty.models import Project, Unit

from . import services
from .models import Booking, Client, ClientActivity


def clean_phone(value: str) -> str:
    value = normalize_phone((value or "").strip())
    try:
        validate_uz_phone(value)
    except DjangoValidationError as exc:
        raise serializers.ValidationError(exc.messages)
    return value


def user_brief(user) -> dict | None:
    if not user:
        return None
    return {"id": user.id, "full_name": user.full_name or user.phone}


class ClientSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    # Model validatorlaridan oldin normallashtirish uchun ("90 123 45 67" ham qabul qilinadi)
    phone = serializers.CharField(max_length=25)
    phone2 = serializers.CharField(max_length=25, required=False, allow_blank=True)
    source_display = serializers.CharField(source="get_source_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    manager = CompanyScopedPrimaryKeyRelatedField(
        queryset=User.objects.filter(is_active=True, role__in=[Role.DIRECTOR, Role.MANAGER]),
        allow_null=True, required=False,
    )
    manager_info = serializers.SerializerMethodField()
    interested_project = CompanyScopedPrimaryKeyRelatedField(
        queryset=Project.objects.all(), allow_null=True, required=False
    )
    interested_project_name = serializers.CharField(source="interested_project.name", read_only=True, default=None)
    created_by_info = serializers.SerializerMethodField()
    active_bookings = serializers.IntegerField(read_only=True, default=0)
    can_edit = serializers.SerializerMethodField()

    class Meta:
        model = Client
        fields = [
            "id", "last_name", "first_name", "middle_name", "full_name", "phone", "phone2",
            "source", "source_display", "status", "status_display", "reject_reason",
            "manager", "manager_info", "interested_project", "interested_project_name", "budget", "note",
            "created_by_info", "active_bookings", "can_edit", "created_at", "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]
        extra_kwargs = {"note": {"max_length": 2000}}

    @property
    def _user(self):
        return self.context["request"].user

    def get_manager_info(self, obj) -> dict | None:
        return user_brief(obj.manager)

    def get_created_by_info(self, obj) -> dict | None:
        return user_brief(obj.created_by)

    def get_can_edit(self, obj) -> bool:
        return services.can_manage_client(self._user, obj)

    def validate_first_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Ism majburiy.")
        return value

    def validate_phone(self, value):
        value = clean_phone(value)
        qs = Client.objects.filter(company=self._user.company, phone=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        existing = qs.select_related("manager").first()
        if existing:
            owner = existing.manager.full_name if existing.manager else "biriktirilmagan"
            if self._user.role == Role.DIRECTOR or existing.manager_id == self._user.id:
                raise serializers.ValidationError(f"Bu raqam bilan mijoz allaqachon bor: {existing.full_name} (mas'ul: {owner}).")
            # Menejerga begona mijozning ismi ko'rsatilmaydi — faqat mas'ul shaxs
            raise serializers.ValidationError(f"Bu raqam bazada allaqachon bor (mas'ul: {owner}).")
        return value

    def validate_phone2(self, value):
        return clean_phone(value) if value else ""

    def validate_status(self, value):
        current = self.instance.status if self.instance else None
        if value == current:
            return value
        if current in Client.AUTO_STATUSES:
            raise serializers.ValidationError("Bron yoki shartnomasi bor mijoz holati avtomatik boshqariladi.")
        if value not in Client.MANUAL_STATUSES:
            raise serializers.ValidationError("Bu holat faqat bron/shartnoma orqali o'rnatiladi.")
        return value

    def validate_manager(self, value):
        user = self._user
        current = self.instance.manager if self.instance else None
        if user.role != Role.DIRECTOR and value != current and not (self.instance is None and value == user):
            raise serializers.ValidationError("Mas'ul menejerni faqat direktor o'zgartiradi.")
        return value

    def validate(self, attrs):
        status = attrs.get("status", self.instance.status if self.instance else Client.Status.NEW)
        reason = attrs.get("reject_reason", self.instance.reject_reason if self.instance else "").strip()
        if status == Client.Status.REJECTED and not reason:
            raise serializers.ValidationError({"reject_reason": "Rad etish sababini yozing."})
        if status != Client.Status.REJECTED:
            reason = ""
        attrs["reject_reason"] = reason
        for f in ("last_name", "middle_name", "note"):
            if f in attrs:
                attrs[f] = attrs[f].strip()
        return attrs


class ActivitySerializer(serializers.ModelSerializer):
    kind_display = serializers.CharField(source="get_kind_display", read_only=True)
    author_info = serializers.SerializerMethodField()

    class Meta:
        model = ClientActivity
        fields = ["id", "kind", "kind_display", "text", "author_info", "booking", "created_at"]
        read_only_fields = ["booking", "created_at"]

    def get_author_info(self, obj) -> dict | None:
        return user_brief(obj.author)

    def validate_kind(self, value):
        if value not in ClientActivity.MANUAL_KINDS:
            raise serializers.ValidationError("Faqat izoh, qo'ng'iroq yoki uchrashuv qo'shish mumkin.")
        return value

    def validate_text(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Matn bo'sh bo'lmasin.")
        return value


class BookingSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    unit_info = serializers.SerializerMethodField()
    client_info = serializers.SerializerMethodField()
    created_by_info = serializers.SerializerMethodField()
    closed_by_info = serializers.SerializerMethodField()
    can_manage = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = [
            "id", "unit", "unit_info", "client", "client_info", "status", "status_display", "expires_at",
            "price_per_m2", "total_price", "note", "created_by_info", "closed_at", "closed_by_info",
            "cancel_reason", "can_manage", "created_at",
        ]
        read_only_fields = fields

    def get_unit_info(self, obj) -> dict:
        u = obj.unit
        return {
            "id": u.id, "number": u.number, "floor": u.floor, "entrance": u.entrance, "rooms": u.rooms,
            "area": str(u.area), "unit_type": u.unit_type, "status": u.status,
            "block_id": u.block_id, "block_name": u.block.name,
            "project_id": u.block.project_id, "project_name": u.block.project.name,
        }

    def get_client_info(self, obj) -> dict:
        c = obj.client
        return {"id": c.id, "full_name": c.full_name, "phone": c.phone, "status": c.status}

    def get_created_by_info(self, obj) -> dict | None:
        return user_brief(obj.created_by)

    def get_closed_by_info(self, obj) -> dict | None:
        return user_brief(obj.closed_by)

    def get_can_manage(self, obj) -> bool:
        return obj.status == Booking.Status.ACTIVE and services.can_manage_booking(self.context["request"].user, obj)


class BookingCreateSerializer(serializers.Serializer):
    unit = CompanyScopedPrimaryKeyRelatedField(queryset=Unit.objects.all())
    client = CompanyScopedPrimaryKeyRelatedField(queryset=Client.objects.select_related("manager"))
    days = serializers.IntegerField(min_value=1, max_value=services.MAX_BOOKING_DAYS)
    note = serializers.CharField(required=False, allow_blank=True, max_length=500, default="")

    def validate_client(self, value):
        # Menejerga begona mijoz "topilmadi" bo'lib ko'rinadi (mavjudligini oshkor qilmaymiz)
        if not services.can_manage_client(self.context["request"].user, value):
            raise serializers.ValidationError("Mijoz topilmadi.")
        return value

    def validate_note(self, value):
        return value.strip()


class BookingCancelSerializer(serializers.Serializer):
    reason = serializers.CharField(min_length=3, max_length=255)

    def validate_reason(self, value):
        value = value.strip()
        if len(value) < 3:
            raise serializers.ValidationError("Sababni yozing.")
        return value


class BookingExtendSerializer(serializers.Serializer):
    days = serializers.IntegerField(min_value=1, max_value=services.MAX_BOOKING_DAYS)
