from apps.realty.models import Block, PriceChange, Unit

from .conftest import GEN, auth


# --- Loyihalar ---

def test_director_creates_project_manager_cannot(api, director_a, manager_a):
    assert auth(api, manager_a).post("/api/v1/projects/", {"name": "X"}).status_code == 403
    r = auth(api, director_a).post("/api/v1/projects/", {"name": "Navro'z Park", "city": "Toshkent"})
    assert r.status_code == 201, r.data


def test_project_name_unique_per_company(api, director_a, project_a):
    r = auth(api, director_a).post("/api/v1/projects/", {"name": "yangi hayot"})
    assert r.status_code == 400


def test_project_list_stats_and_isolation(api, manager_a, block_a, project_b):
    r = auth(api, manager_a).get("/api/v1/projects/")
    assert [p["name"] for p in r.data["results"]] == ["Yangi Hayot"]
    p = r.data["results"][0]
    assert p["units_total"] == 30 and p["units_available"] == 30 and p["blocks_count"] == 1


def test_other_company_project_404(api, director_a, project_b):
    auth(api, director_a)
    assert api.get(f"/api/v1/projects/{project_b.id}/").status_code == 404
    assert api.get(f"/api/v1/projects/{project_b.id}/chessboard/").status_code == 404
    assert api.delete(f"/api/v1/projects/{project_b.id}/").status_code == 404


# --- Bloklar va generatsiya ---

def test_create_block_with_generation(api, director_a, project_a):
    r = auth(api, director_a).post("/api/v1/blocks/", {
        "project": project_a.id, "name": "B", "floors_count": 9, "entrances_count": 2, "units_per_floor": 3,
        "start_floor": 2, "generate": GEN,
    }, format="json")
    assert r.status_code == 201, r.data
    block = Block.objects.get(pk=r.data["id"])
    units = block.units.all()
    assert units.count() == 9 * 2 * 3
    assert block.company_id == director_a.company_id
    assert set(units.values_list("company_id", flat=True)) == {director_a.company_id}
    # raqamlash: 1-podyezd pastdan boshlanadi
    first = units.get(number="1")
    assert (first.entrance, first.floor, first.position) == (1, 2, 1)
    assert units.get(number="28").entrance == 2
    # narx qavat bo'yicha oshadi, umumiy narx = maydon × narx
    low, high = units.get(entrance=1, floor=2, position=2), units.get(entrance=1, floor=10, position=2)
    assert low.price_per_m2 == 10_000_000 and high.price_per_m2 == 10_800_000
    assert low.total_price == 605_000_000


def test_cannot_create_block_in_other_company_project(api, director_a, project_b):
    r = auth(api, director_a).post("/api/v1/blocks/", {
        "project": project_b.id, "name": "X", "floors_count": 2, "units_per_floor": 1,
    }, format="json")
    assert r.status_code == 400
    assert not Block.objects.filter(project=project_b).exists()


def test_layout_must_match_units_per_floor(api, director_a, project_a):
    r = auth(api, director_a).post("/api/v1/blocks/", {
        "project": project_a.id, "name": "C", "floors_count": 3, "units_per_floor": 5, "generate": GEN,
    }, format="json")
    assert r.status_code == 400


def test_block_limits(api, director_a, project_a):
    r = auth(api, director_a).post("/api/v1/blocks/", {
        "project": project_a.id, "name": "Huge", "floors_count": 500, "units_per_floor": 3,
    }, format="json")
    assert r.status_code == 400


def test_block_structure_locked_after_units(api, director_a, block_a):
    r = auth(api, director_a).patch(f"/api/v1/blocks/{block_a.id}/", {"floors_count": 20}, format="json")
    assert r.status_code == 400
    assert api.patch(f"/api/v1/blocks/{block_a.id}/", {"name": "A-1"}, format="json").status_code == 200


def test_cannot_delete_block_with_sold_units(api, director_a, block_a):
    block_a.units.filter(number="1").update(status=Unit.Status.SOLD)
    assert auth(api, director_a).delete(f"/api/v1/blocks/{block_a.id}/").status_code == 400
    assert auth(api, director_a).delete(f"/api/v1/projects/{block_a.project_id}/").status_code == 400


# --- Xonadonlar ---

def test_unit_filters(api, manager_a, block_a):
    auth(api, manager_a)
    r = api.get("/api/v1/units/", {"rooms": "1,3", "floor_min": 4, "page_size": 100})
    assert r.data["count"] == 2 * 2 * 2  # 2 xil xona × 2 qavat × 2 podyezd
    assert all(u["rooms"] in (1, 3) and u["floor"] >= 4 for u in r.data["results"])


def test_manager_cannot_change_price(api, manager_a, block_a):
    unit = block_a.units.first()
    assert auth(api, manager_a).patch(f"/api/v1/units/{unit.id}/", {"price_per_m2": 1}).status_code == 403


def test_director_changes_price_and_history_recorded(api, director_a, block_a):
    unit = block_a.units.get(number="2")
    r = auth(api, director_a).patch(f"/api/v1/units/{unit.id}/", {"price_per_m2": 12_000_000, "price_reason": "aksiya tugadi"})
    assert r.status_code == 200
    assert r.data["total_price"] == 726_000_000
    h = api.get(f"/api/v1/units/{unit.id}/price-history/").data
    assert len(h) == 1 and h[0]["reason"] == "aksiya tugadi" and h[0]["old_price_per_m2"] == 10_000_000


def test_cannot_set_booked_or_sold_manually(api, director_a, block_a):
    unit = block_a.units.first()
    r = auth(api, director_a).patch(f"/api/v1/units/{unit.id}/", {"status": "sold"})
    assert r.status_code == 400
    assert api.patch(f"/api/v1/units/{unit.id}/", {"status": "not_for_sale"}).status_code == 200


def test_sold_unit_price_locked(api, director_a, block_a):
    unit = block_a.units.first()
    Unit.objects.filter(pk=unit.pk).update(status=Unit.Status.SOLD)
    r = auth(api, director_a).patch(f"/api/v1/units/{unit.id}/", {"price_per_m2": 1})
    assert r.status_code == 400
    r = api.patch(f"/api/v1/units/{unit.id}/", {"status": "available"})
    assert r.status_code == 400


def test_units_cannot_be_created_or_deleted_directly(api, director_a, block_a):
    auth(api, director_a)
    assert api.post("/api/v1/units/", {}).status_code == 405
    assert api.delete(f"/api/v1/units/{block_a.units.first().id}/").status_code == 405


def test_bulk_price_percent_skips_sold(api, director_a, block_a):
    block_a.units.filter(number="1").update(status=Unit.Status.SOLD)
    r = auth(api, director_a).post("/api/v1/units/bulk-price/", {
        "block": block_a.id, "mode": "percent", "value": "10", "reason": "yangi narx",
    }, format="json")
    assert r.status_code == 200, r.data
    assert r.data == {"updated": 29, "skipped_locked": 1}
    assert block_a.units.get(number="1").price_per_m2 == 10_000_000
    assert block_a.units.get(number="2").price_per_m2 == 11_000_000
    assert PriceChange.objects.count() == 29


def test_bulk_price_cannot_touch_other_company(api, director_b, block_a):
    ids = list(block_a.units.values_list("id", flat=True))
    r = auth(api, director_b).post("/api/v1/units/bulk-price/", {
        "units": ids, "mode": "set", "value": "1",
    }, format="json")
    assert r.status_code == 200 and r.data["updated"] == 0
    assert not block_a.units.filter(price_per_m2=1).exists()


def test_bulk_price_validation(api, director_a, block_a):
    auth(api, director_a)
    assert api.post("/api/v1/units/bulk-price/", {"mode": "set", "value": "1"}, format="json").status_code == 400
    assert api.post("/api/v1/units/bulk-price/", {"block": block_a.id, "mode": "percent", "value": "500"}, format="json").status_code == 400


# --- Shaxmatka ---

def test_chessboard_structure(api, manager_a, block_a):
    r = auth(api, manager_a).get(f"/api/v1/projects/{block_a.project_id}/chessboard/")
    assert r.status_code == 200
    d = r.data
    assert d["summary"]["total"] == 30 and d["summary"]["available"] == 30
    b = d["blocks"][0]
    assert len(b["entrances"]) == 2
    floors = b["entrances"][0]["floors"]
    assert [f["floor"] for f in floors] == [5, 4, 3, 2, 1]  # yuqoridan pastga
    assert [u["position"] for u in floors[0]["units"]] == [1, 2, 3]


def test_chessboard_filters_mark_matches(api, manager_a, block_a):
    r = auth(api, manager_a).get(
        f"/api/v1/projects/{block_a.project_id}/chessboard/", {"rooms": "2", "price_max": "620000000"}
    )
    units = [u for e in r.data["blocks"][0]["entrances"] for f in e["floors"] for u in f["units"]]
    assert len(units) == 30  # hech biri olib tashlanmaydi
    matched = [u for u in units if u["match"]]
    assert matched and all(u["rooms"] == 2 and u["total_price"] <= 620_000_000 for u in matched)
    assert r.data["summary"]["matched"] == len(matched)


def test_chessboard_garbage_params_ignored(api, manager_a, block_a):
    r = auth(api, manager_a).get(
        f"/api/v1/projects/{block_a.project_id}/chessboard/", {"rooms": "abc", "price_min": "x'; drop", "status": "hack"}
    )
    assert r.status_code == 200 and r.data["summary"]["matched"] == 30


def test_chessboard_query_count_constant(api, manager_a, project_a, django_assert_max_num_queries):
    from decimal import Decimal

    from apps.realty import services

    for name in ("K1", "K2", "K3"):
        b = Block.objects.create(project=project_a, name=name, floors_count=16, entrances_count=4, units_per_floor=6)
        services.generate_units(b, [services.LayoutItem(rooms=2, area=Decimal("55"))] * 6, 9_000_000)
    auth(api, manager_a)
    with django_assert_max_num_queries(8):
        r = api.get(f"/api/v1/projects/{project_a.id}/chessboard/")
    assert r.data["summary"]["total"] == 3 * 16 * 4 * 6
