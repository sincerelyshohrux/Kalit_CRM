"""Shaxmatka: loyiha bo'yicha bloklar -> podyezdlar -> qavatlar -> xonadonlar.

Bitta SQL so'rov bilan barcha xonadonlar olinadi (N+1 yo'q). Filtrlar xonadonlarni
o'chirib tashlamaydi — har biriga `match` belgisi qo'yiladi, frontend mos
kelmaganlarini xira ko'rsatadi.
"""

from collections import Counter, defaultdict
from decimal import Decimal, InvalidOperation

from django.core.files.storage import default_storage

from .models import Layout, Project, Unit

UNIT_FIELDS = (
    "id", "block_id", "entrance", "floor", "position", "number", "unit_type",
    "rooms", "area", "price_per_m2", "total_price", "status", "finishing", "layout_id",
)


def _int_list(raw: str | None) -> set[int] | None:
    if not raw:
        return None
    try:
        return {int(x) for x in raw.split(",")[:30] if x.strip() != ""}
    except ValueError:
        return None


def _num(raw: str | None):
    if raw in (None, ""):
        return None
    try:
        return Decimal(raw)
    except InvalidOperation:
        return None


def parse_filters(params) -> dict:
    statuses = {s for s in (params.get("status") or "").split(",") if s in Unit.Status.values}
    return {
        "rooms": _int_list(params.get("rooms")),
        "status": statuses or None,
        "price_min": _num(params.get("price_min")),
        "price_max": _num(params.get("price_max")),
        "area_min": _num(params.get("area_min")),
        "area_max": _num(params.get("area_max")),
    }


def _matches(u: dict, f: dict) -> bool:
    if f["rooms"] is not None and u["rooms"] not in f["rooms"]:
        return False
    if f["status"] is not None and u["status"] not in f["status"]:
        return False
    if f["price_min"] is not None and u["total_price"] < f["price_min"]:
        return False
    if f["price_max"] is not None and u["total_price"] > f["price_max"]:
        return False
    if f["area_min"] is not None and u["area"] < f["area_min"]:
        return False
    if f["area_max"] is not None and u["area"] > f["area_max"]:
        return False
    return True


def _summary(counter: Counter) -> dict:
    return {
        "total": sum(counter.values()),
        **{status: counter.get(status, 0) for status in Unit.Status.values},
    }


def _bookings(blocks, user) -> dict[int, dict]:
    """Faol bronlar: xonadon -> qisqa ma'lumot. Menejerga begona mijoz ismi ko'rsatilmaydi."""
    from apps.accounts.models import Role
    from apps.crm.models import Booking

    rows = Booking.objects.filter(unit__block__in=blocks, status=Booking.Status.ACTIVE).values(
        "id", "unit_id", "expires_at", "created_by_id", "client_id", "client__manager_id",
        "client__first_name", "client__last_name", "created_by__first_name", "created_by__last_name",
    )
    result = {}
    for r in rows:
        mine = user is not None and user.id in (r["created_by_id"], r["client__manager_id"])
        visible = user is None or user.role != Role.MANAGER or mine
        result[r["unit_id"]] = {
            "id": r["id"],
            "expires_at": r["expires_at"].isoformat(),
            "manager": f"{r['created_by__first_name']} {r['created_by__last_name']}".strip() or None,
            "client_id": r["client_id"] if visible else None,
            "client_name": f"{r['client__last_name']} {r['client__first_name']}".strip() if visible else None,
            "mine": mine,
        }
    return result


def build_chessboard(project: Project, params, user=None, *, include_bookings: bool = True) -> dict:
    filters = parse_filters(params)
    block_id = _int_list(params.get("block"))

    blocks = list(project.blocks.all())
    if block_id:
        blocks = [b for b in blocks if b.id in block_id]

    units = Unit.objects.filter(block__in=blocks).values(*UNIT_FIELDS).order_by("entrance", "-floor", "position")

    bookings = _bookings(blocks, user) if include_bookings else {}

    # block -> entrance -> floor -> [units]
    grid: dict = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))
    per_block: dict[int, Counter] = defaultdict(Counter)
    total, matched = Counter(), 0
    for u in units:
        u["area"] = str(u["area"])
        u["match"] = _matches({**u, "area": Decimal(u["area"])}, filters)
        u["booking"] = bookings.get(u["id"])
        matched += u["match"]
        grid[u["block_id"]][u["entrance"]][u["floor"]].append(u)
        per_block[u["block_id"]][u["status"]] += 1
        total[u["status"]] += 1

    result_blocks = []
    for b in blocks:
        entrances = []
        for e in range(1, b.entrances_count + 1):
            floors = [
                {"floor": fl, "units": grid[b.id][e].get(fl, [])}
                for fl in range(b.top_floor, b.start_floor - 1, -1)
            ]
            entrances.append({"entrance": e, "floors": floors})
        result_blocks.append(
            {
                "id": b.id,
                "name": b.name,
                "floors_count": b.floors_count,
                "entrances_count": b.entrances_count,
                "units_per_floor": b.units_per_floor,
                "start_floor": b.start_floor,
                "top_floor": b.top_floor,
                "summary": _summary(per_block[b.id]),
                "entrances": entrances,
            }
        )

    layouts = [
        {
            "id": lay["id"], "name": lay["name"], "rooms": lay["rooms"], "area": str(lay["area"]),
            "image": default_storage.url(lay["image"]) if lay["image"] else None,
            "thumb": default_storage.url(lay["thumb"]) if lay["thumb"] else None,
        }
        for lay in Layout.objects.filter(project=project).values("id", "name", "rooms", "area", "image", "thumb")
    ]

    return {
        "project": {"id": project.id, "name": project.name, "status": project.status},
        "layouts": layouts,
        "summary": {**_summary(total), "matched": matched},
        "statuses": [{"value": v, "label": label} for v, label in Unit.Status.choices],
        "blocks": result_blocks,
    }
