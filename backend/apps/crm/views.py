import re

from django.db import transaction
from django.db.models import Count, Q
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from apps.accounts.models import Role
from apps.common.mixins import CompanyScopedViewSetMixin

from . import services
from .models import Booking, Client, ClientActivity
from .serializers import (
    ActivitySerializer,
    BookingCancelSerializer,
    BookingCreateSerializer,
    BookingExtendSerializer,
    BookingSerializer,
    ClientSerializer,
)

SEARCH_MAX = 100


class ExpireBookingsMixin:
    """Har so'rovda muddati o'tgan bronlarni yopadi (cron ishlamasa ham ma'lumot to'g'ri bo'ladi)."""

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        services.expire_overdue_bookings(request.user.company)


PHONE_LIKE = re.compile(r"^[\d\s+()\-]+$")


def apply_client_search(qs, raw: str, prefix: str = ""):
    """Raqam bo'lagi ("90 123 45") bo'yicha yoki ism/familiya so'zlari bo'yicha qidiruv."""
    raw = (raw or "").strip()[:SEARCH_MAX]
    if not raw:
        return qs
    if PHONE_LIKE.match(raw):
        digits = re.sub(r"\D", "", raw)
        if len(digits) < 3:
            return qs.none()
        return qs.filter(Q(**{f"{prefix}phone__contains": digits}) | Q(**{f"{prefix}phone2__contains": digits}))
    for word in raw.split()[:4]:
        qs = qs.filter(
            Q(**{f"{prefix}first_name__icontains": word})
            | Q(**{f"{prefix}last_name__icontains": word})
            | Q(**{f"{prefix}middle_name__icontains": word})
        )
    return qs


class ClientViewSet(ExpireBookingsMixin, CompanyScopedViewSetMixin, viewsets.ModelViewSet):
    """Mijozlar bazasi.

    - Direktor va kassir — barcha mijozlarni ko'radi; menejer — o'zinikini va biriktirilmaganlarni.
    - Tahrirlash: direktor — hammasini, menejer — o'z mijozlarini. Kassir — faqat ko'rish.
    - O'chirish — faqat direktor va mijozda bron tarixi bo'lmasa.
    """

    queryset = Client.objects.select_related("manager", "created_by", "interested_project")
    serializer_class = ClientSerializer
    write_roles = [Role.DIRECTOR, Role.MANAGER]
    filterset_fields = ["status", "source", "manager", "interested_project"]
    search_fields = []  # o'zimizning qidiruv (telefon formatini tushunadi)
    ordering_fields = ["created_at", "updated_at", "first_name", "last_name", "budget"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == Role.MANAGER:
            qs = qs.filter(Q(manager=user) | Q(manager__isnull=True))
        params = self.request.query_params
        if params.get("mine") in ("1", "true"):
            qs = qs.filter(manager=user)
        if params.get("unassigned") in ("1", "true"):
            qs = qs.filter(manager__isnull=True)
        qs = apply_client_search(qs, params.get("search", ""))
        return qs.annotate(
            active_bookings=Count("bookings", filter=Q(bookings__status=Booking.Status.ACTIVE), distinct=True)
        ).order_by("-updated_at", "-id")

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        if request.method not in ("GET", "HEAD", "OPTIONS") and self.action != "activities":
            if not services.can_manage_client(request.user, obj):
                raise PermissionDenied("Bu mijoz boshqa menejerga biriktirilgan.")

    @transaction.atomic
    def perform_create(self, serializer):
        user = self.request.user
        extra = {"company": user.company, "created_by": user}
        if user.role == Role.MANAGER:
            extra["manager"] = user  # menejer kiritgan mijoz doim o'ziga biriktiriladi
        client = serializer.save(**extra)
        services.log(client, ClientActivity.Kind.CREATED, user, client.get_source_display())

    @transaction.atomic
    def perform_update(self, serializer):
        old = Client.objects.select_for_update().get(pk=serializer.instance.pk)
        client = serializer.save()
        user = self.request.user
        if old.status != client.status:
            text = f"{old.get_status_display()} → {client.get_status_display()}"
            if client.reject_reason:
                text += f": {client.reject_reason}"
            services.log(client, ClientActivity.Kind.STATUS, user, text)
        if old.manager_id != client.manager_id:
            name = client.manager.full_name if client.manager else "biriktirilmagan"
            services.log(client, ClientActivity.Kind.MANAGER, user, f"Mas'ul: {name}")

    def perform_destroy(self, instance):
        if self.request.user.role != Role.DIRECTOR:
            raise PermissionDenied("Mijozni faqat direktor o'chira oladi.")
        if instance.bookings.exists():
            raise ValidationError({"detail": "Mijozda bron tarixi bor — o'chirib bo'lmaydi. Holatini «Rad etdi» qiling."})
        instance.delete()

    @extend_schema(request=ActivitySerializer, responses=ActivitySerializer(many=True))
    @action(detail=True, methods=["get", "post"], pagination_class=None)
    def activities(self, request, pk=None):
        """Mijoz tarixi (oxirgi 200 ta). POST — izoh/qo'ng'iroq/uchrashuv qo'shish."""
        client = self.get_object()
        if request.method == "POST":
            if not services.can_manage_client(request.user, client):
                raise PermissionDenied("Bu mijoz boshqa menejerga biriktirilgan.")
            serializer = ActivitySerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            with transaction.atomic():
                serializer.save(company=client.company, client=client, author=request.user)
                client.save(update_fields=["updated_at"])  # ro'yxatda tepaga chiqsin
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        qs = client.activities.select_related("author")[:200]
        return Response(ActivitySerializer(qs, many=True).data)

    @extend_schema(responses={200: dict})
    @action(detail=False, methods=["get"], filter_backends=[], pagination_class=None)
    def stats(self, request):
        """Holatlar bo'yicha soni (voronka) — joriy foydalanuvchi ko'ra oladigan mijozlar uchun."""
        qs = super().get_queryset()
        if request.user.role == Role.MANAGER:
            qs = qs.filter(Q(manager=request.user) | Q(manager__isnull=True))
        rows = dict(qs.order_by().values_list("status").annotate(c=Count("id")))
        mine = qs.filter(manager=request.user).count()
        return Response({
            "total": sum(rows.values()),
            "mine": mine,
            **{s: rows.get(s, 0) for s in Client.Status.values},
        })


BOOKING_PARAMS = [
    OpenApiParameter("status", str, description="active, expired, cancelled, converted"),
    OpenApiParameter("project", int), OpenApiParameter("client", int), OpenApiParameter("unit", int),
    OpenApiParameter("mine", bool), OpenApiParameter("search", str),
]


class BookingViewSet(
    ExpireBookingsMixin,
    CompanyScopedViewSetMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Bronlar. Yaratish/bekor qilish/uzaytirish — direktor va menejer (kassir faqat ko'radi).

    Menejer faqat o'zi qilgan yoki o'z mijozlariga tegishli bronlarni ko'radi va boshqaradi.
    """

    queryset = Booking.objects.select_related(
        "unit", "unit__block", "unit__block__project", "client", "created_by", "closed_by"
    )
    serializer_class = BookingSerializer
    write_roles = [Role.DIRECTOR, Role.MANAGER]
    filterset_fields = ["status", "client", "unit"]
    search_fields = []
    ordering_fields = ["created_at", "expires_at", "total_price"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == Role.MANAGER:
            qs = qs.filter(Q(created_by=user) | Q(client__manager=user))
        params = self.request.query_params
        if params.get("mine") in ("1", "true"):
            qs = qs.filter(created_by=user)
        project = params.get("project", "")
        if project.isdigit():
            qs = qs.filter(unit__block__project_id=int(project))
        qs = apply_client_search(qs, params.get("search", ""), prefix="client__")
        return qs.order_by("-created_at", "-id")

    def get_throttles(self):
        if self.action in ("create", "extend"):
            self.throttle_scope = "booking"
            return [*super().get_throttles(), ScopedRateThrottle()]
        return super().get_throttles()

    @extend_schema(parameters=BOOKING_PARAMS)
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @extend_schema(request=BookingCreateSerializer, responses={201: BookingSerializer})
    def create(self, request):
        serializer = BookingCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        booking = services.create_booking(user=request.user, **serializer.validated_data)
        fresh = self.get_queryset().get(pk=booking.pk)
        return Response(self.get_serializer(fresh).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=BookingCancelSerializer, responses=BookingSerializer)
    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        serializer = BookingCancelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        booking = services.cancel_booking(self.get_object(), request.user, serializer.validated_data["reason"])
        return Response(self.get_serializer(self.get_queryset().get(pk=booking.pk)).data)

    @extend_schema(request=BookingExtendSerializer, responses=BookingSerializer)
    @action(detail=True, methods=["post"])
    def extend(self, request, pk=None):
        serializer = BookingExtendSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        booking = services.extend_booking(self.get_object(), request.user, serializer.validated_data["days"])
        return Response(self.get_serializer(self.get_queryset().get(pk=booking.pk)).data)

    @extend_schema(responses={200: dict})
    @action(detail=False, methods=["get"], filter_backends=[], pagination_class=None)
    def stats(self, request):
        qs = Booking.objects.filter(company=request.user.company)
        if request.user.role == Role.MANAGER:
            qs = qs.filter(Q(created_by=request.user) | Q(client__manager=request.user))
        rows = dict(qs.order_by().values_list("status").annotate(c=Count("id")))
        return Response({
            **{s: rows.get(s, 0) for s in Booking.Status.values},
            "max_days": services.max_days_for(request.user),
            "company_days": request.user.company.booking_days,
        })
