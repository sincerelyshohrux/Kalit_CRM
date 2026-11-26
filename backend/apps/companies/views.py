from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Role, User
from apps.common.permissions import HasRole, IsCompanyMember, IsSuperAdmin

from .models import Company
from .serializers import CompanySerializer, PlatformCompanySerializer


class MyCompanyView(generics.RetrieveUpdateAPIView):
    """Joriy foydalanuvchining kompaniyasi. Tahrirlash — faqat direktor."""

    serializer_class = CompanySerializer
    permission_classes = [IsCompanyMember, HasRole]
    write_roles = [Role.DIRECTOR]
    http_method_names = ["get", "patch"]

    def get_object(self):
        return self.request.user.company


class PlatformCompanyViewSet(viewsets.ModelViewSet):
    """Platforma admini: barcha kompaniyalarni boshqarish."""

    serializer_class = PlatformCompanySerializer
    permission_classes = [IsSuperAdmin]
    filterset_fields = ["status", "plan", "city"]
    search_fields = ["name", "legal_name", "inn", "phone"]
    ordering_fields = ["name", "created_at", "subscription_until"]

    def get_queryset(self):
        return Company.objects.annotate(
            users_count=Count("users", filter=Q(users__is_active=True))
        ).order_by("-created_at")

    @action(detail=True, methods=["post"])
    def suspend(self, request, pk=None):
        company = self.get_object()
        company.status = Company.Status.SUSPENDED
        company.save(update_fields=["status", "updated_at"])
        return Response(self.get_serializer(company).data)

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        company = self.get_object()
        company.status = Company.Status.ACTIVE
        company.save(update_fields=["status", "updated_at"])
        return Response(self.get_serializer(company).data)


class PlatformStatsView(APIView):
    """Platforma admin dashboardi uchun umumiy ko'rsatkichlar."""

    permission_classes = [IsSuperAdmin]

    @extend_schema(responses={200: dict})
    def get(self, request):
        today = timezone.localdate()
        companies = Company.objects.all()
        expiring = companies.filter(
            subscription_until__gte=today,
            subscription_until__lte=today + timedelta(days=14),
        ).count()
        return Response(
            {
                "companies_total": companies.count(),
                "companies_active": companies.filter(status=Company.Status.ACTIVE).count(),
                "companies_suspended": companies.filter(status=Company.Status.SUSPENDED).count(),
                "subscriptions_expiring_14d": expiring,
                "subscriptions_expired": companies.filter(subscription_until__lt=today).count(),
                "users_total": User.objects.exclude(role=Role.SUPERADMIN).filter(is_active=True).count(),
                "by_plan": dict(
                    companies.values_list("plan").annotate(c=Count("id")).values_list("plan", "c")
                ),
            },
            status=status.HTTP_200_OK,
        )
