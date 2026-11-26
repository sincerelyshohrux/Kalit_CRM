from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from apps.common.fields import CompanyScopedPrimaryKeyRelatedField

from . import services
from .models import MAX_UNITS_PER_FLOOR, Block, PriceChange, Project, Unit

MAX_PRICE_PER_M2 = 1_000_000_000  # 1 mlrd so'm/m² — aqlga sig'maydigan qiymatlardan himoya


class StatsMixin(serializers.Serializer):
    units_total = serializers.IntegerField(read_only=True)
    units_available = serializers.IntegerField(read_only=True)
    units_booked = serializers.IntegerField(read_only=True)
    units_sold = serializers.IntegerField(read_only=True)
    min_price = serializers.IntegerField(read_only=True, allow_null=True)


class ProjectSerializer(StatsMixin, serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    housing_class_display = serializers.CharField(source="get_housing_class_display", read_only=True)
    blocks_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Project
        fields = [
            "id", "name", "city", "district", "address", "description",
            "housing_class", "housing_class_display", "status", "status_display",
            "start_date", "completion_date", "cover", "is_active",
            "blocks_count", "units_total", "units_available", "units_booked", "units_sold", "min_price",
            "created_at", "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def validate_name(self, value):
        company = self.context["request"].user.company
        qs = Project.objects.filter(company=company, name__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Bu nomdagi loyiha allaqachon mavjud.")
        return value

    def validate(self, attrs):
        start = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end = attrs.get("completion_date", getattr(self.instance, "completion_date", None))
        if start and end and end < start:
            raise serializers.ValidationError({"completion_date": "Topshirish sanasi boshlanish sanasidan oldin bo'lishi mumkin emas."})
        return attrs


class LayoutItemSerializer(serializers.Serializer):
    rooms = serializers.IntegerField(min_value=0, max_value=20)
    area = serializers.DecimalField(max_digits=8, decimal_places=2, min_value=Decimal("1"), max_value=Decimal("10000"))
    unit_type = serializers.ChoiceField(choices=Unit.UnitType.choices, default=Unit.UnitType.APARTMENT)


class GenerateSerializer(serializers.Serializer):
    """Blok yaratilganda xonadonlarni avtomatik generatsiya qilish parametrlari."""

    layout = LayoutItemSerializer(many=True, min_length=1, max_length=MAX_UNITS_PER_FLOOR)
    base_price_per_m2 = serializers.IntegerField(min_value=0, max_value=MAX_PRICE_PER_M2)
    floor_step_percent = serializers.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("0"), min_value=Decimal("-10"), max_value=Decimal("10"),
        help_text="Har qavatda narx necha foizga oshadi",
    )


class BlockSerializer(StatsMixin, serializers.ModelSerializer):
    project = CompanyScopedPrimaryKeyRelatedField(queryset=Project.objects.all())
    project_name = serializers.CharField(source="project.name", read_only=True)
    top_floor = serializers.IntegerField(read_only=True)
    generate = GenerateSerializer(write_only=True, required=False)

    class Meta:
        model = Block
        fields = [
            "id", "project", "project_name", "name", "floors_count", "entrances_count", "units_per_floor",
            "start_floor", "top_floor", "completion_date", "sort_order", "generate",
            "units_total", "units_available", "units_booked", "units_sold", "min_price",
            "created_at", "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    STRUCTURE_FIELDS = ("floors_count", "entrances_count", "units_per_floor", "start_floor", "project")

    def validate(self, attrs):
        project = attrs.get("project", getattr(self.instance, "project", None))
        name = attrs.get("name", getattr(self.instance, "name", None))
        qs = Block.objects.filter(project=project, name__iexact=name)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError({"name": "Bu loyihada shu nomdagi blok bor."})

        if self.instance and self.instance.units.exists():
            changed = [f for f in self.STRUCTURE_FIELDS if f in attrs and attrs[f] != getattr(self.instance, f)]
            if changed:
                raise serializers.ValidationError(
                    {"detail": "Xonadonlari bor blokning tuzilishini (qavat, podyezd, loyiha) o'zgartirib bo'lmaydi."}
                )

        gen = attrs.get("generate")
        if gen and len(gen["layout"]) != attrs.get("units_per_floor", getattr(self.instance, "units_per_floor", None)):
            raise serializers.ValidationError({"generate": "Planirovkadagi xonadonlar soni 'units_per_floor' ga teng bo'lishi kerak."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        gen = validated_data.pop("generate", None)
        block = super().create(validated_data)
        if gen:
            services.generate_units(
                block,
                [services.LayoutItem(**item) for item in gen["layout"]],
                gen["base_price_per_m2"],
                gen["floor_step_percent"],
            )
        return block

    def update(self, instance, validated_data):
        validated_data.pop("generate", None)
        return super().update(instance, validated_data)


class UnitSerializer(serializers.ModelSerializer):
    block_name = serializers.CharField(source="block.name", read_only=True)
    project_id = serializers.IntegerField(source="block.project_id", read_only=True)
    project_name = serializers.CharField(source="block.project.name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    unit_type_display = serializers.CharField(source="get_unit_type_display", read_only=True)
    price_per_m2 = serializers.IntegerField(min_value=0, max_value=MAX_PRICE_PER_M2)
    price_reason = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=255)

    class Meta:
        model = Unit
        fields = [
            "id", "project_id", "project_name", "block", "block_name", "entrance", "floor", "position", "number",
            "unit_type", "unit_type_display", "rooms", "area", "price_per_m2", "total_price",
            "status", "status_display", "finishing", "has_balcony", "layout_image", "note",
            "price_reason", "created_at", "updated_at",
        ]
        # Joylashuv generatsiya paytida belgilanadi; holat bron/shartnoma orqali o'zgaradi
        read_only_fields = ["block", "entrance", "floor", "position", "total_price", "created_at", "updated_at"]

    def validate_status(self, value):
        if value not in Unit.MANUAL_STATUSES:
            raise serializers.ValidationError("Bron va sotilgan holatlari faqat bron/shartnoma orqali o'rnatiladi.")
        if self.instance and self.instance.status in Unit.LOCKED_STATUSES and value != self.instance.status:
            raise serializers.ValidationError("Bron qilingan yoki sotilgan xonadon holatini qo'lda o'zgartirib bo'lmaydi.")
        return value

    def validate(self, attrs):
        if self.instance and self.instance.status in Unit.LOCKED_STATUSES:
            locked = {"price_per_m2", "area", "rooms", "unit_type"} & attrs.keys()
            if any(attrs[f] != getattr(self.instance, f) for f in locked):
                raise serializers.ValidationError(
                    {"detail": "Bron qilingan yoki sotilgan xonadonning narxi va parametrlarini o'zgartirib bo'lmaydi."}
                )
        return attrs

    @transaction.atomic
    def update(self, instance, validated_data):
        reason = validated_data.pop("price_reason", "")
        old_ppm, old_total = instance.price_per_m2, instance.total_price
        unit = super().update(instance, validated_data)
        services.record_price_change(unit, old_ppm, old_total, self.context["request"].user, reason)
        return unit


class BulkPriceSerializer(serializers.Serializer):
    """Ommaviy narx o'zgartirish. Qamrov: blok, qavatlar oralig'i, xonalar soni yoki aniq xonadonlar."""

    block = CompanyScopedPrimaryKeyRelatedField(queryset=Block.objects.all(), required=False)
    project = CompanyScopedPrimaryKeyRelatedField(queryset=Project.objects.all(), required=False)
    units = serializers.ListField(child=serializers.IntegerField(min_value=1), required=False, max_length=5000)
    floor_from = serializers.IntegerField(required=False)
    floor_to = serializers.IntegerField(required=False)
    rooms = serializers.ListField(child=serializers.IntegerField(min_value=0, max_value=20), required=False, max_length=21)
    mode = serializers.ChoiceField(choices=services.PriceMode.CHOICES)
    value = serializers.DecimalField(max_digits=14, decimal_places=2)
    reason = serializers.CharField(required=False, allow_blank=True, max_length=255)

    def validate(self, attrs):
        if not any(attrs.get(k) for k in ("block", "project", "units")):
            raise serializers.ValidationError({"detail": "Kamida bittasini tanlang: loyiha, blok yoki xonadonlar."})
        mode, value = attrs["mode"], attrs["value"]
        if mode == services.PriceMode.SET and not (0 <= value <= MAX_PRICE_PER_M2):
            raise serializers.ValidationError({"value": "Noto'g'ri narx."})
        if mode == services.PriceMode.PERCENT and not (-50 <= value <= 100):
            raise serializers.ValidationError({"value": "Foiz -50 dan 100 gacha bo'lishi kerak."})
        if mode == services.PriceMode.AMOUNT and abs(value) > MAX_PRICE_PER_M2:
            raise serializers.ValidationError({"value": "Juda katta qiymat."})
        return attrs

    def build_queryset(self, company):
        qs = Unit.objects.filter(company=company)
        d = self.validated_data
        if d.get("project"):
            qs = qs.filter(block__project=d["project"])
        if d.get("block"):
            qs = qs.filter(block=d["block"])
        if d.get("units"):
            qs = qs.filter(pk__in=d["units"])
        if d.get("floor_from") is not None:
            qs = qs.filter(floor__gte=d["floor_from"])
        if d.get("floor_to") is not None:
            qs = qs.filter(floor__lte=d["floor_to"])
        if d.get("rooms"):
            qs = qs.filter(rooms__in=d["rooms"])
        return qs


class PriceChangeSerializer(serializers.ModelSerializer):
    changed_by_name = serializers.CharField(source="changed_by.full_name", read_only=True, default=None)

    class Meta:
        model = PriceChange
        fields = [
            "id", "unit", "old_price_per_m2", "new_price_per_m2", "old_total", "new_total",
            "changed_by", "changed_by_name", "reason", "created_at",
        ]
        read_only_fields = fields
