from django.db.models import Count, Min, Q
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from apps.accounts.models import Role
from apps.common.mixins import CompanyScopedViewSetMixin

from . import services
from .chessboard import build_chessboard
from .filters import UnitFilter
from .models import Block, PriceChange, Project, Unit
from .serializers import (
    BlockSerializer,
    BulkPriceSerializer,
    PriceChangeSerializer,
    ProjectSerializer,
    UnitSerializer,
)


def unit_stats(prefix: str = "") -> dict:
    """Loyiha/blok bo'yicha xonadonlar statistikasi (annotate uchun)."""
    f = f"{prefix}units"
    return {
        "units_total": Count(f, distinct=True),
        "units_available": Count(f, filter=Q(**{f"{f}__status": Unit.Status.AVAILABLE}), distinct=True),
        "units_booked": Count(f, filter=Q(**{f"{f}__status": Unit.Status.BOOKED}), distinct=True),
        "units_sold": Count(f, filter=Q(**{f"{f}__status": Unit.Status.SOLD}), distinct=True),
        "min_price": Min(f"{f}__total_price", filter=Q(**{f"{f}__status": Unit.Status.AVAILABLE})),
    }


def ensure_no_locked_units(units_qs, what: str):
    if units_qs.filter(status__in=Unit.LOCKED_STATUSES).exists():
        raise ValidationError({"detail": f"{what}da bron qilingan yoki sotilgan xonadonlar bor — o'chirib bo'lmaydi."})


CHESSBOARD_PARAMS = [
    OpenApiParameter("block", str, description="Blok ID'lari, vergul bilan"),
    OpenApiParameter("rooms", str, description="Xonalar soni, vergul bilan: 1,2,3"),
    OpenApiParameter("status", str, description="Holatlar: available,booked,sold,not_for_sale"),
    OpenApiParameter("price_min", int), OpenApiParameter("price_max", int),
    OpenApiParameter("area_min", float), OpenApiParameter("area_max", float),
]


class ProjectViewSet(CompanyScopedViewSetMixin, viewsets.ModelViewSet):
    """Loyihalar (ЖК). Ko'rish — barcha xodimlar, o'zgartirish — direktor."""

    queryset = Project.objects.all()
    serializer_class = ProjectSerializer
    write_roles = [Role.DIRECTOR]
    filterset_fields = ["status", "housing_class", "city", "is_active"]
    search_fields = ["name", "address", "district"]
    ordering_fields = ["name", "created_at", "completion_date"]

    def get_queryset(self):
        return (
            super().get_queryset()
            .annotate(blocks_count=Count("blocks", distinct=True), **unit_stats("blocks__"))
            .order_by("-created_at")
        )

    def perform_destroy(self, instance):
        ensure_no_locked_units(Unit.objects.filter(block__project=instance), "Loyiha")
        instance.delete()

    @extend_schema(parameters=CHESSBOARD_PARAMS, responses={200: dict})
    @action(detail=True, methods=["get"], filter_backends=[], pagination_class=None)
    def chessboard(self, request, pk=None):
        """Shaxmatka: bloklar → podyezdlar → qavatlar (yuqoridan pastga) → xonadonlar."""
        return Response(build_chessboard(self.get_object(), request.query_params))


class BlockViewSet(CompanyScopedViewSetMixin, viewsets.ModelViewSet):
    """Bloklar. POST'da `generate` berilsa, xonadonlar avtomatik yaratiladi."""

    queryset = Block.objects.select_related("project")
    serializer_class = BlockSerializer
    write_roles = [Role.DIRECTOR]
    filterset_fields = ["project"]
    search_fields = ["name"]
    ordering_fields = ["sort_order", "name", "created_at"]

    def get_queryset(self):
        return super().get_queryset().annotate(**unit_stats()).order_by("sort_order", "name")

    def perform_create(self, serializer):
        # company Block.save() da loyihadan olinadi; loyiha esa tenant-scoped maydon orqali tekshirilgan
        serializer.save()

    def perform_destroy(self, instance):
        ensure_no_locked_units(instance.units.all(), "Blok")
        instance.delete()


class UnitViewSet(
    CompanyScopedViewSetMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Xonadonlar. Yaratish — blok generatsiyasi orqali; tahrirlash — direktor.

    Bron/sotilgan holatlari faqat bron va shartnoma modullari orqali o'rnatiladi.
    """

    queryset = Unit.objects.select_related("block", "block__project")
    serializer_class = UnitSerializer
    write_roles = [Role.DIRECTOR]
    filterset_class = UnitFilter
    search_fields = ["number", "note"]
    ordering_fields = ["total_price", "price_per_m2", "area", "floor", "rooms", "number"]

    @extend_schema(request=BulkPriceSerializer, responses={200: dict})
    @action(detail=False, methods=["post"], url_path="bulk-price")
    def bulk_price(self, request):
        """Ommaviy narx o'zgartirish (bron/sotilganlar o'zgarmaydi)."""
        serializer = BulkPriceSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        qs = serializer.build_queryset(request.user.company)
        result = services.bulk_change_price(
            qs,
            serializer.validated_data["mode"],
            serializer.validated_data["value"],
            request.user,
            serializer.validated_data.get("reason", ""),
        )
        return Response(result, status=status.HTTP_200_OK)

    @extend_schema(responses=PriceChangeSerializer(many=True))
    @action(detail=True, methods=["get"], url_path="price-history")
    def price_history(self, request, pk=None):
        unit = self.get_object()
        qs = PriceChange.objects.filter(unit=unit, company=request.user.company).select_related("changed_by")[:100]
        return Response(PriceChangeSerializer(qs, many=True).data)

    def get_throttles(self):
        if self.action == "bulk_price":
            self.throttle_scope = "bulk"
            return [*super().get_throttles(), ScopedRateThrottle()]
        return super().get_throttles()
