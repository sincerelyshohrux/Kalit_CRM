from django.db import transaction
from django.db.models import Count, IntegerField, Min, OuterRef, Prefetch, Q, Subquery
from django.db.models.functions import Coalesce
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from apps.accounts.models import Role
from apps.common.mixins import CompanyScopedViewSetMixin
from apps.crm.models import Booking
from apps.crm.services import expire_overdue_bookings

from . import services
from .chessboard import build_chessboard
from .filters import UnitFilter
from .models import Block, Layout, PriceChange, Project, ProjectPhoto, Unit
from .serializers import (
    BlockSerializer,
    BulkPriceSerializer,
    LayoutSerializer,
    PhotoReorderSerializer,
    ProjectPhotoSerializer,
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


def count_by_project(model):
    """Loyiha bo'yicha sanoq — JOIN'siz subquery (xonadonlar soni bilan ko'paymasligi uchun)."""
    sub = model.objects.filter(project=OuterRef("pk")).order_by().values("project").annotate(c=Count("id")).values("c")[:1]
    return Coalesce(Subquery(sub, output_field=IntegerField()), 0)


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
        first_photo = ProjectPhoto.objects.filter(project=OuterRef("pk")).order_by("sort_order", "id").values("thumb")[:1]
        return (
            super().get_queryset()
            .annotate(
                blocks_count=Count("blocks", distinct=True),
                photos_count=count_by_project(ProjectPhoto),
                layouts_count=count_by_project(Layout),
                cover_path=Subquery(first_photo),
                **unit_stats("blocks__"),
            )
            .order_by("-created_at")
        )

    def perform_destroy(self, instance):
        ensure_no_locked_units(Unit.objects.filter(block__project=instance), "Loyiha")
        instance.delete()

    @extend_schema(parameters=CHESSBOARD_PARAMS, responses={200: dict})
    @action(detail=True, methods=["get"], filter_backends=[], pagination_class=None)
    def chessboard(self, request, pk=None):
        """Shaxmatka: bloklar → podyezdlar → qavatlar (yuqoridan pastga) → xonadonlar."""
        expire_overdue_bookings(request.user.company)
        return Response(build_chessboard(self.get_object(), request.query_params, request.user))


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

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # company Block.save() da loyihadan olinadi; loyiha esa tenant-scoped maydon orqali tekshirilgan
        block = serializer.save()
        # Javobda statistika ham bo'lsin (generatsiya qilingan xonadonlar soni)
        fresh = self.get_queryset().get(pk=block.pk)
        return Response(self.get_serializer(fresh).data, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def perform_destroy(self, instance):
        ensure_no_locked_units(instance.units.all(), "Blok")
        project = instance.project
        instance.delete()
        # Generatsiyada avtomatik yaratilgan, endi bo'sh qolgan va chizmasi yo'q planirovkalarni tozalaymiz
        Layout.objects.filter(project=project, units__isnull=True, image="").delete()


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

    queryset = Unit.objects.select_related("block", "block__project", "layout").prefetch_related(
        Prefetch(
            "bookings",
            queryset=Booking.objects.filter(status=Booking.Status.ACTIVE).select_related("client", "created_by"),
            to_attr="active_bookings",
        )
    )
    serializer_class = UnitSerializer
    write_roles = [Role.DIRECTOR]
    filterset_class = UnitFilter
    search_fields = ["number", "note"]
    ordering_fields = ["total_price", "price_per_m2", "area", "floor", "rooms", "number"]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        expire_overdue_bookings(request.user.company)

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


class ProjectChildMixin:
    """Galereya va planirovkalar: ro'yxat faqat bitta loyiha bo'yicha (`?project=`), sahifalashsiz."""

    pagination_class = None
    write_roles = [Role.DIRECTOR]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.action == "list":
            raw = self.request.query_params.get("project", "")
            if not raw.isdigit():
                raise ValidationError({"project": "Loyiha ko'rsatilishi shart: ?project=<id>"})
            qs = qs.filter(project_id=int(raw))
        return qs

    def get_throttles(self):
        if self.action in ("create", "update", "partial_update"):
            self.throttle_scope = "upload"
            return [*super().get_throttles(), ScopedRateThrottle()]
        return super().get_throttles()

    def perform_create(self, serializer):
        # company modelning save() ida loyihadan olinadi; loyiha esa tenant-scoped maydon orqali tekshirilgan
        serializer.save()


class ProjectPhotoViewSet(ProjectChildMixin, CompanyScopedViewSetMixin, viewsets.ModelViewSet):
    """Loyiha galereyasi. Yuklash — multipart/form-data. Rasm qayta ishlanadi (EXIF/GPS o'chadi, WebP)."""

    queryset = ProjectPhoto.objects.all()
    serializer_class = ProjectPhotoSerializer
    filterset_fields = ["block", "kind"]
    search_fields = []
    ordering_fields = ["sort_order", "created_at"]

    @extend_schema(request=PhotoReorderSerializer, responses={200: dict})
    @action(detail=False, methods=["post"])
    def reorder(self, request):
        """Rasmlar tartibini saqlash: `{"project": 1, "ids": [5, 3, 4]}` — birinchisi muqova bo'ladi."""
        serializer = PhotoReorderSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        ids = serializer.validated_data["ids"]
        with transaction.atomic():
            photos = {p.id: p for p in ProjectPhoto.objects.select_for_update().filter(id__in=ids)}
            for order, pk in enumerate(ids, start=1):
                photos[pk].sort_order = order
            ProjectPhoto.objects.bulk_update(photos.values(), ["sort_order"])
        return Response({"ok": True})


class LayoutViewSet(ProjectChildMixin, CompanyScopedViewSetMixin, viewsets.ModelViewSet):
    """Planirovkalar. Blok generatsiyasida avtomatik yaratiladi; chizma (rasm) keyin yuklanadi."""

    queryset = Layout.objects.all()
    serializer_class = LayoutSerializer
    filterset_fields = ["unit_type", "rooms"]
    search_fields = ["name"]
    ordering_fields = ["rooms", "area", "name"]

    def get_queryset(self):
        return (
            super().get_queryset()
            .annotate(
                units_count=Count("units", distinct=True),
                units_available=Count("units", filter=Q(units__status=Unit.Status.AVAILABLE), distinct=True),
                min_price=Min("units__total_price", filter=Q(units__status=Unit.Status.AVAILABLE)),
            )
            .order_by("rooms", "area", "id")
        )

    def perform_destroy(self, instance):
        if instance.units.filter(status__in=Unit.LOCKED_STATUSES).exists():
            raise ValidationError({"detail": "Bu planirovkadagi xonadonlar bron qilingan yoki sotilgan — o'chirib bo'lmaydi."})
        instance.delete()
