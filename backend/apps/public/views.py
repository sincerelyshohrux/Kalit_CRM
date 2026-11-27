"""Ommaviy sayt API (login talab qilinmaydi).

Qoida: bu yerdan faqat oq ro'yxatdagi maydonlar chiqadi. Mijozlar, bronlar, menejerlar,
ichki izohlar, narx tarixi hech qachon qaytarilmaydi. Bron qilingan, sotilgan va
"sotuvda emas" xonadonlar bir xil — "band" bo'lib ko'rinadi (kim/qachon — ko'rinmaydi).
"""

from django.conf import settings
from django.core.files.storage import default_storage
from django.db import IntegrityError, transaction
from django.db.models import Count, Min, OuterRef, Q, Subquery
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils.text import slugify
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from apps.accounts.models import Role
from apps.accounts.security import client_ip
from apps.common.permissions import HasRole, IsCompanyMember
from apps.realty.chessboard import build_chessboard
from apps.realty.models import Layout, Project, ProjectPhoto, Unit

from . import services
from .models import RESERVED_SLUGS, SLUG_RE, SiteSettings
from .serializers import LeadSerializer, SiteSettingsSerializer


class PublicThrottle(AnonRateThrottle):
    scope = "public"


class LeadBurstThrottle(AnonRateThrottle):
    scope = "lead_burst"


class LeadThrottle(AnonRateThrottle):
    scope = "lead"


def media_url(path) -> str | None:
    return default_storage.url(path) if path else None


def get_site(slug: str) -> SiteSettings:
    site = SiteSettings.objects.select_related("company").filter(slug=slug.lower()[:40], is_enabled=True).first()
    # O'chirilgan sayt, bloklangan yoki obunasi tugagan kompaniya — oddiy 404 (sababini oshkor qilmaymiz)
    if site is None or not site.company.is_usable:
        raise Http404
    return site


def visible_projects(site: SiteSettings):
    return Project.objects.filter(company=site.company, is_active=True, show_on_site=True)


def is_free(status_value: str) -> bool:
    return status_value == Unit.Status.AVAILABLE


class PublicView(APIView):
    authentication_classes: list = []
    permission_classes = [AllowAny]
    throttle_classes = [PublicThrottle]


def project_card(p, show_prices: bool) -> dict:
    return {
        "id": p.id, "name": p.name, "city": p.city, "district": p.district, "address": p.address,
        "status": p.status, "status_display": p.get_status_display(),
        "housing_class": p.housing_class, "housing_class_display": p.get_housing_class_display(),
        "completion_date": p.completion_date,
        "latitude": float(p.latitude) if p.latitude is not None else None,
        "longitude": float(p.longitude) if p.longitude is not None else None,
        "cover": media_url(getattr(p, "cover_path", None)),
        "units_available": p.units_available,
        "min_price": p.min_price if show_prices else None,
    }


def annotate_projects(qs):
    free = Q(blocks__units__status=Unit.Status.AVAILABLE)
    first_photo = ProjectPhoto.objects.filter(project=OuterRef("pk")).order_by("sort_order", "id").values("image")[:1]
    return qs.annotate(
        units_available=Count("blocks__units", filter=free, distinct=True),
        min_price=Min("blocks__units__total_price", filter=free),
        cover_path=Subquery(first_photo),
    ).order_by("-created_at")


class SiteView(PublicView):
    """Kompaniya sahifasi: ma'lumot + saytga chiqarilgan loyihalar."""

    def get(self, request, slug):
        site = get_site(slug)
        c = site.company
        return Response({
            "slug": site.slug,
            "company": {"name": c.name, "logo": media_url(c.logo.name if c.logo else None), "city": c.city},
            "headline": site.headline,
            "about": site.about,
            "phone": site.phone or c.phone,
            "telegram": site.telegram,
            "instagram": site.instagram,
            "show_prices": site.show_prices,
            "installment": {
                "enabled": site.installment_enabled and site.show_prices,
                "min_down": site.installment_min_down,
                "max_months": site.installment_max_months,
                "markup": float(site.installment_markup),
            },
            "turnstile_site_key": settings.TURNSTILE_SITE_KEY or None,
            "projects": [project_card(p, site.show_prices) for p in annotate_projects(visible_projects(site))],
        })


class ProjectView(PublicView):
    """Loyiha sahifasi: tavsif, galereya, planirovkalar, lokatsiya va atrofdagi joylar."""

    def get(self, request, slug, pk):
        site = get_site(slug)
        project = get_object_or_404(annotate_projects(visible_projects(site)), pk=pk)
        free = Q(units__status=Unit.Status.AVAILABLE)
        layouts = (
            Layout.objects.filter(project=project)
            .annotate(available=Count("units", filter=free), min_price=Min("units__total_price", filter=free))
            .filter(available__gt=0)
            .order_by("rooms", "area")
        )
        photos = ProjectPhoto.objects.filter(project=project).order_by("sort_order", "id")
        return Response({
            **project_card(project, site.show_prices),
            "description": project.description,
            "start_date": project.start_date,
            "nearby": project.nearby,
            "blocks": [{"id": b.id, "name": b.name, "floors_count": b.floors_count} for b in project.blocks.order_by("sort_order", "name")],
            "photos": [
                {
                    "id": ph.id, "kind": ph.kind, "kind_display": ph.get_kind_display(), "caption": ph.caption,
                    "image": media_url(ph.image.name), "thumb": media_url(ph.thumb.name),
                    "width": ph.width, "height": ph.height,
                }
                for ph in photos
            ],
            "layouts": [
                {
                    "id": lay.id, "name": lay.name, "rooms": lay.rooms, "area": str(lay.area), "unit_type": lay.unit_type,
                    "image": media_url(lay.image.name if lay.image else None),
                    "thumb": media_url(lay.thumb.name if lay.thumb else None),
                    "available": lay.available,
                    "min_price": lay.min_price if site.show_prices else None,
                }
                for lay in layouts
            ],
        })


PUBLIC_UNIT_FIELDS = ("id", "entrance", "floor", "position", "number", "unit_type", "rooms", "area", "layout_id", "match")


class ChessboardView(PublicView):
    """Ommaviy shaxmatka. Narx filtrlari faqat narxlar ochiq bo'lsa ishlaydi (aks holda filtr orqali narxni bilib olish mumkin)."""

    def get(self, request, slug, pk):
        site = get_site(slug)
        project = get_object_or_404(visible_projects(site), pk=pk)
        allowed = {"block", "rooms", "area_min", "area_max"}
        if site.show_prices:
            allowed |= {"price_min", "price_max"}
        params = {k: request.query_params.get(k) for k in allowed if request.query_params.get(k)}
        if request.query_params.get("free") in ("1", "true"):
            params["status"] = Unit.Status.AVAILABLE
        board = build_chessboard(project, params, include_bookings=False)

        free_total = matched = 0
        for block in board["blocks"]:
            for entrance in block["entrances"]:
                for floor in entrance["floors"]:
                    units = []
                    for u in floor["units"]:
                        free = is_free(u["status"])
                        item = {k: u[k] for k in PUBLIC_UNIT_FIELDS}
                        item["free"] = free
                        item["total_price"] = u["total_price"] if free and site.show_prices else None
                        item["price_per_m2"] = u["price_per_m2"] if free and site.show_prices else None
                        units.append(item)
                        free_total += free
                        matched += u["match"]
                    floor["units"] = units
            s = block["summary"]
            block["summary"] = {"total": s["total"], "free": s[Unit.Status.AVAILABLE]}

        return Response({
            "project": {"id": project.id, "name": project.name},
            "show_prices": site.show_prices,
            "layouts": board["layouts"],
            "summary": {"total": board["summary"]["total"], "free": free_total, "matched": matched},
            "blocks": board["blocks"],
        })


class UnitView(PublicView):
    def get(self, request, slug, pk):
        site = get_site(slug)
        unit = get_object_or_404(
            Unit.objects.select_related("block", "block__project", "layout").filter(block__project__in=visible_projects(site)),
            pk=pk,
        )
        free = is_free(unit.status)
        show = free and site.show_prices
        lay = unit.layout
        return Response({
            "id": unit.id, "number": unit.number, "floor": unit.floor, "entrance": unit.entrance,
            "unit_type": unit.unit_type, "unit_type_display": unit.get_unit_type_display(),
            "rooms": unit.rooms, "area": str(unit.area),
            "finishing": unit.finishing, "finishing_display": unit.get_finishing_display(),
            "has_balcony": unit.has_balcony, "free": free,
            "total_price": unit.total_price if show else None,
            "price_per_m2": unit.price_per_m2 if show else None,
            "block": {"id": unit.block_id, "name": unit.block.name, "floors_count": unit.block.floors_count},
            "project": {"id": unit.block.project_id, "name": unit.block.project.name},
            "layout": {
                "id": lay.id, "name": lay.name, "description": lay.description,
                "image": media_url(lay.image.name if lay.image else None),
                "thumb": media_url(lay.thumb.name if lay.thumb else None),
            } if lay else None,
        })


class LeadView(PublicView):
    """Ariza: CRM'da yangi lid (yoki mavjud mijoz tarixiga yozuv) + menejerlarga bildirishnoma."""

    throttle_classes = [LeadBurstThrottle, LeadThrottle]

    def post(self, request, slug):
        site = get_site(slug)
        serializer = LeadSerializer(data=request.data, context={"site": site, "projects": visible_projects(site)})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        ok = {"ok": True, "detail": "Arizangiz qabul qilindi. Menejerimiz tez orada bog'lanadi."}

        # Honeypot: odam ko'rmaydigan maydon to'ldirilgan — bot. Unga "muvaffaqiyat" ko'rsatamiz, lekin saqlamaymiz.
        if data.get("website"):
            services.logger.info("Honeypot ishladi: %s", slug)
            return Response(ok, status=status.HTTP_201_CREATED)
        if not services.verify_turnstile(data.get("token", ""), client_ip(request)):
            return Response({"detail": "Bot tekshiruvidan o'tmadi. Sahifani yangilab, qayta urinib ko'ring."}, status=status.HTTP_400_BAD_REQUEST)

        services.submit_lead(
            company=site.company,
            first_name=data["first_name"], last_name=data.get("last_name", ""), phone=data["phone"],
            project=data.get("project"), unit=data.get("unit"), message=data.get("message", ""),
        )
        return Response(ok, status=status.HTTP_201_CREATED)


# ---------------- Kompaniya paneli: sayt sozlamalari ----------------



def suggest_slug(name: str) -> str:
    base = slugify(name.replace("'", "").replace("ʻ", ""))[:32].strip("-") or "kompaniya"
    if len(base) < 3:
        base = f"{base}-uz"
    candidate, n = base, 2
    while candidate in RESERVED_SLUGS or not SLUG_RE.match(candidate) or SiteSettings.objects.filter(slug=candidate).exists():
        candidate = f"{base}-{n}"
        n += 1
    return candidate


def get_or_create_site(company) -> SiteSettings:
    site = SiteSettings.objects.filter(company=company).first()
    if site:
        return site
    for _ in range(3):  # parallel so'rovda slug to'qnashsa — qayta urinish
        try:
            with transaction.atomic():
                return SiteSettings.objects.create(company=company, slug=suggest_slug(company.name), phone=company.phone)
        except IntegrityError:
            site = SiteSettings.objects.filter(company=company).first()
            if site:
                return site
    raise IntegrityError("slug")


class SiteSettingsView(generics.RetrieveUpdateAPIView):
    """Sayt sozlamalari. Ko'rish — barcha xodimlar (havolani ulashish uchun), o'zgartirish — direktor."""

    serializer_class = SiteSettingsSerializer
    permission_classes = [IsCompanyMember, HasRole]
    write_roles = [Role.DIRECTOR]
    http_method_names = ["get", "patch"]

    def get_object(self):
        return get_or_create_site(self.request.user.company)
