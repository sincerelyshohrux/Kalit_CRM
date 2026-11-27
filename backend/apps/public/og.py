"""Ijtimoiy tarmoqlar uchun HTML: Telegram/Instagram/Facebook havolani ochganda JS ishlatmaydi,
shuning uchun sarlavha, tavsif va rasm (Open Graph) serverda HTML ichiga qo'yiladi.

Productionda nginx `/<slug>/...` so'rovlarini shu view'ga yuboradi; view build qilingan
`frontend/dist/index.html` ga meta teglarni qo'shib qaytaradi, React esa odatdagidek ishga tushadi.
"""

from functools import lru_cache

from django.conf import settings
from django.core.files.storage import default_storage
from django.http import Http404, HttpResponse
from django.utils.html import escape

from apps.realty.models import ProjectPhoto, Unit

from .views import get_site, visible_projects


@lru_cache(maxsize=1)
def _index_html(mtime: float) -> str:
    return settings.FRONTEND_INDEX.read_text(encoding="utf-8")


def index_html() -> str:
    path = settings.FRONTEND_INDEX
    if not path.exists():
        raise Http404("Frontend build topilmadi (npm run build)")
    return _index_html(path.stat().st_mtime)


def absolute(path: str | None) -> str | None:
    return f"{settings.PUBLIC_BASE_URL}{default_storage.url(path)}" if path else None


def cover_of(project) -> str | None:
    photo = ProjectPhoto.objects.filter(project=project).order_by("sort_order", "id").values_list("image", flat=True).first()
    return absolute(photo)


def build_meta(slug: str, kind: str | None, pk: int | None) -> dict:
    site = get_site(slug)
    company = site.company.name
    url = f"{settings.PUBLIC_BASE_URL}/{site.slug}"
    projects = visible_projects(site)
    meta = {
        "title": f"{company} — yangi uylar",
        "description": site.headline or site.about[:160] or f"{company}: bo'sh xonadonlar, narxlar va planirovkalar",
        "image": cover_of(projects.first()) if projects.exists() else None,
        "url": url,
    }
    if kind == "loyiha" and pk:
        project = projects.filter(pk=pk).first()
        if project is None:
            raise Http404
        free = Unit.objects.filter(block__project=project, status=Unit.Status.AVAILABLE).count()
        place = ", ".join(p for p in (project.city, project.district) if p)
        meta.update(
            title=f"{project.name} — {company}",
            description=" · ".join(p for p in (place, f"{free} ta bo'sh xonadon", project.get_status_display()) if p),
            image=cover_of(project) or meta["image"],
            url=f"{url}/loyiha/{project.id}",
        )
    elif kind == "xonadon" and pk:
        unit = Unit.objects.select_related("block__project", "layout").filter(block__project__in=projects, pk=pk).first()
        if unit is None:
            raise Http404
        rooms = "Studiya" if unit.rooms == 0 else f"{unit.rooms} xonali"
        parts = [f"{rooms}, {unit.area} m²", f"{unit.floor}-qavat"]
        if unit.status == Unit.Status.AVAILABLE and site.show_prices:
            parts.append(f"{unit.total_price:,} so'm".replace(",", " "))
        meta.update(
            title=f"{unit.block.project.name} · №{unit.number} — {company}",
            description=" · ".join(parts),
            image=absolute(unit.layout.image.name if unit.layout and unit.layout.image else None) or cover_of(unit.block.project),
            url=f"{url}/xonadon/{unit.id}",
        )
    return meta


def public_html(request, slug, kind=None, pk=None):
    meta = build_meta(slug, kind, int(pk) if pk else None)
    tags = [
        f"<title>{escape(meta['title'])}</title>",
        f'<meta name="description" content="{escape(meta["description"])}">',
        '<meta property="og:type" content="website">',
        f'<meta property="og:title" content="{escape(meta["title"])}">',
        f'<meta property="og:description" content="{escape(meta["description"])}">',
        f'<meta property="og:url" content="{escape(meta["url"])}">',
        f'<link rel="canonical" href="{escape(meta["url"])}">',
        '<meta name="twitter:card" content="summary_large_image">',
    ]
    if meta.get("image"):
        tags.append(f'<meta property="og:image" content="{escape(meta["image"])}">')
    html = index_html()
    # Asl <title> ni olib tashlab, o'rniga to'liq meta blokini qo'yamiz
    start, end = html.find("<title>"), html.find("</title>")
    if start != -1 and end != -1:
        html = html[:start] + html[end + len("</title>"):]
    html = html.replace("</head>", "\n    " + "\n    ".join(tags) + "\n  </head>", 1)
    response = HttpResponse(html, content_type="text/html; charset=utf-8")
    response["Cache-Control"] = "public, max-age=300"
    return response
