from datetime import timedelta

from decimal import Decimal

import pytest
from django.core.management import call_command
from django.utils import timezone

from apps.accounts.models import Role
from apps.crm.models import Booking, Client, ClientActivity
from apps.realty.models import Unit

from .conftest import auth, make_user

pytestmark = pytest.mark.django_db

CLIENTS = "/api/v1/clients/"
BOOKINGS = "/api/v1/bookings/"


@pytest.fixture
def manager2_a(company_a):
    return make_user("+998901000004", Role.MANAGER, company_a)


@pytest.fixture
def unit(block_a):
    return block_a.units.order_by("id").first()


def new_client(api, user, phone="+998931112233", **extra):
    res = auth(api, user).post(CLIENTS, {"first_name": "Aziz", "last_name": "Karimov", "phone": phone, **extra}, format="json")
    assert res.status_code == 201, res.data
    return res.data


def book(api, user, unit, client_id, days=3, **extra):
    return auth(api, user).post(BOOKINGS, {"unit": unit.id, "client": client_id, "days": days, **extra}, format="json")


# ---------- Mijozlar ----------


def test_client_create_normalizes_phone_and_logs(api, manager_a):
    data = new_client(api, manager_a, phone="93 111 22 33")
    assert data["phone"] == "+998931112233"
    assert data["manager"] == manager_a.id  # menejer kiritsa — o'ziga biriktiriladi
    assert data["status"] == "new"
    assert ClientActivity.objects.filter(client_id=data["id"], kind="created").exists()


def test_duplicate_phone_rejected_same_company_only(api, director_a, manager_a, director_b):
    new_client(api, director_a)
    res = auth(api, manager_a).post(CLIENTS, {"first_name": "B", "phone": "+998 93 111-22-33"}, format="json")
    assert res.status_code == 400
    assert "Karimov" not in str(res.data["phone"])  # menejerga begona mijoz ismi oshkor qilinmaydi
    # boshqa kompaniyada shu raqam bo'lishi mumkin
    new_client(api, director_b)


def test_invalid_phone(api, manager_a):
    res = auth(api, manager_a).post(CLIENTS, {"first_name": "A", "phone": "12345"}, format="json")
    assert res.status_code == 400


def test_manager_sees_only_own_and_unassigned(api, director_a, manager_a, manager2_a):
    own = new_client(api, manager_a, phone="+998931110001")
    other = new_client(api, manager2_a, phone="+998931110002")
    free = new_client(api, director_a, phone="+998931110003")
    ids = {c["id"] for c in auth(api, manager_a).get(CLIENTS).data["results"]}
    assert ids == {own["id"], free["id"]}
    assert auth(api, manager_a).get(f"{CLIENTS}{other['id']}/").status_code == 404
    assert len(auth(api, director_a).get(CLIENTS).data["results"]) == 3


def test_manager_cannot_reassign_or_edit_unassigned_manager(api, director_a, manager_a, manager2_a):
    c = new_client(api, manager_a)
    res = auth(api, manager_a).patch(f"{CLIENTS}{c['id']}/", {"manager": manager2_a.id}, format="json")
    assert res.status_code == 400
    res = auth(api, director_a).patch(f"{CLIENTS}{c['id']}/", {"manager": manager2_a.id}, format="json")
    assert res.status_code == 200
    assert ClientActivity.objects.filter(client_id=c["id"], kind="manager").exists()


def test_cannot_assign_foreign_company_user(api, director_a, director_b):
    res = auth(api, director_a).post(
        CLIENTS, {"first_name": "A", "phone": "+998931119999", "manager": director_b.id}, format="json"
    )
    assert res.status_code == 400


def test_cashier_read_only(api, cashier_a, director_a):
    new_client(api, director_a)
    assert auth(api, cashier_a).get(CLIENTS).status_code == 200
    res = auth(api, cashier_a).post(CLIENTS, {"first_name": "A", "phone": "+998931119998"}, format="json")
    assert res.status_code == 403


def test_tenant_isolation(api, director_a, director_b):
    c = new_client(api, director_a)
    assert auth(api, director_b).get(f"{CLIENTS}{c['id']}/").status_code == 404
    assert auth(api, director_b).patch(f"{CLIENTS}{c['id']}/", {"note": "x"}, format="json").status_code == 404


def test_status_rules(api, manager_a):
    c = new_client(api, manager_a)
    url = f"{CLIENTS}{c['id']}/"
    assert auth(api, manager_a).patch(url, {"status": "booked"}, format="json").status_code == 400
    assert auth(api, manager_a).patch(url, {"status": "rejected"}, format="json").status_code == 400  # sababsiz
    res = auth(api, manager_a).patch(url, {"status": "rejected", "reject_reason": "Narx qimmat"}, format="json")
    assert res.status_code == 200
    res = auth(api, manager_a).patch(url, {"status": "contacted"}, format="json")
    assert res.data["reject_reason"] == ""
    assert ClientActivity.objects.filter(client_id=c["id"], kind="status").count() == 2


def test_search_by_phone_fragment_and_name(api, director_a):
    new_client(api, director_a, phone="+998931234567")
    new_client(api, director_a, phone="+998907654321", first_name="Dilnoza", last_name="Rahimova")
    assert len(auth(api, director_a).get(CLIENTS, {"search": "93 123"}).data["results"]) == 1
    assert len(auth(api, director_a).get(CLIENTS, {"search": "dilnoza rahim"}).data["results"]) == 1
    assert len(auth(api, director_a).get(CLIENTS, {"search": "12"}).data["results"]) == 0


def test_activities_add_and_kind_whitelist(api, manager_a, manager2_a):
    c = new_client(api, manager_a)
    url = f"{CLIENTS}{c['id']}/activities/"
    assert auth(api, manager_a).post(url, {"kind": "call", "text": "Qo'ng'iroq qildim"}, format="json").status_code == 201
    assert auth(api, manager_a).post(url, {"kind": "booking_created", "text": "x"}, format="json").status_code == 400
    assert auth(api, manager2_a).post(url, {"kind": "note", "text": "x"}, format="json").status_code == 404
    kinds = [a["kind"] for a in auth(api, manager_a).get(url).data]
    assert kinds[0] == "call"


def test_delete_client_director_only_and_without_bookings(api, director_a, manager_a, unit):
    c = new_client(api, manager_a)
    assert auth(api, manager_a).delete(f"{CLIENTS}{c['id']}/").status_code == 403
    book(api, manager_a, unit, c["id"])
    assert auth(api, director_a).delete(f"{CLIENTS}{c['id']}/").status_code == 400
    c2 = new_client(api, manager_a, phone="+998931110077")
    assert auth(api, director_a).delete(f"{CLIENTS}{c2['id']}/").status_code == 204


def test_stats(api, director_a):
    new_client(api, director_a)
    data = auth(api, director_a).get(f"{CLIENTS}stats/").data
    assert data["total"] == 1 and data["new"] == 1


# ---------- Bron ----------


def test_booking_flow(api, manager_a, unit):
    c = new_client(api, manager_a)
    res = book(api, manager_a, unit, c["id"], days=2, note="Avans keyin")
    assert res.status_code == 201, res.data
    assert res.data["total_price"] == unit.total_price
    unit.refresh_from_db()
    assert unit.status == Unit.Status.BOOKED
    assert Client.objects.get(pk=c["id"]).status == Client.Status.BOOKED
    assert ClientActivity.objects.filter(client_id=c["id"], kind="booking_created").exists()

    # ikkinchi marta bron qilib bo'lmaydi
    c2 = new_client(api, manager_a, phone="+998931110055")
    assert book(api, manager_a, unit, c2["id"]).status_code == 400

    # xonadon API'si faol bronni ko'rsatadi
    data = auth(api, manager_a).get(f"/api/v1/units/{unit.id}/").data
    assert data["active_booking"]["client_id"] == c["id"]


def test_cannot_book_sold_or_not_for_sale(api, manager_a, block_a):
    c = new_client(api, manager_a)
    units = list(block_a.units.order_by("id")[:2])
    Unit.objects.filter(pk=units[0].pk).update(status=Unit.Status.SOLD)
    Unit.objects.filter(pk=units[1].pk).update(status=Unit.Status.NOT_FOR_SALE)
    for u in units:
        assert book(api, manager_a, u, c["id"]).status_code == 400


def test_manager_day_cap_and_director_limit(api, company_a, manager_a, director_a, block_a):
    company_a.booking_days = 3
    company_a.save()
    c = new_client(api, manager_a)
    units = list(block_a.units.order_by("id")[:2])
    assert book(api, manager_a, units[0], c["id"], days=4).status_code == 400
    assert book(api, director_a, units[0], c["id"], days=20).status_code == 201
    assert book(api, director_a, units[1], c["id"], days=31).status_code == 400


def test_cashier_cannot_book(api, cashier_a, director_a, unit):
    c = new_client(api, director_a)
    assert book(api, cashier_a, unit, c["id"]).status_code == 403


def test_cannot_book_foreign_unit_or_client(api, manager_a, manager2_a, director_b, project_b, unit):
    from apps.realty import services as rs
    from apps.realty.models import Block

    b = Block.objects.create(project=project_b, name="X", floors_count=1, entrances_count=1, units_per_floor=1)
    rs.generate_units(b, [rs.LayoutItem(rooms=1, area=Decimal("40"))], 1_000_000, Decimal("0"))
    foreign_unit = b.units.first()
    c = new_client(api, manager_a)
    assert book(api, manager_a, foreign_unit, c["id"]).status_code == 400
    other = new_client(api, manager2_a, phone="+998931110066")
    res = book(api, manager_a, unit, other["id"])
    assert res.status_code == 400 and "client" in res.data


def test_cancel_frees_unit_and_permissions(api, manager_a, manager2_a, director_a, unit):
    c = new_client(api, manager_a)
    bid = book(api, manager_a, unit, c["id"]).data["id"]
    # boshqa menejer bu bronni ko'rmaydi ham
    assert auth(api, manager2_a).post(f"{BOOKINGS}{bid}/cancel/", {"reason": "test"}, format="json").status_code == 404
    assert auth(api, manager_a).post(f"{BOOKINGS}{bid}/cancel/", {"reason": ""}, format="json").status_code == 400
    res = auth(api, manager_a).post(f"{BOOKINGS}{bid}/cancel/", {"reason": "Mijoz fikridan qaytdi"}, format="json")
    assert res.status_code == 200 and res.data["status"] == "cancelled"
    unit.refresh_from_db()
    assert unit.status == Unit.Status.AVAILABLE
    assert Client.objects.get(pk=c["id"]).status == Client.Status.VISITED
    # qayta bekor qilib bo'lmaydi
    assert auth(api, director_a).post(f"{BOOKINGS}{bid}/cancel/", {"reason": "yana"}, format="json").status_code == 400
    # endi qaytadan bron qilish mumkin
    assert book(api, manager_a, unit, c["id"]).status_code == 201


def test_director_can_cancel_any(api, manager_a, director_a, unit):
    c = new_client(api, manager_a)
    bid = book(api, manager_a, unit, c["id"]).data["id"]
    assert auth(api, director_a).post(f"{BOOKINGS}{bid}/cancel/", {"reason": "Direktor qarori"}, format="json").status_code == 200


def test_extend_respects_cap(api, company_a, manager_a, unit):
    company_a.booking_days = 5
    company_a.save()
    c = new_client(api, manager_a)
    bid = book(api, manager_a, unit, c["id"], days=3).data["id"]
    assert auth(api, manager_a).post(f"{BOOKINGS}{bid}/extend/", {"days": 3}, format="json").status_code == 400
    res = auth(api, manager_a).post(f"{BOOKINGS}{bid}/extend/", {"days": 2}, format="json")
    assert res.status_code == 200
    assert ClientActivity.objects.filter(client_id=c["id"], kind="booking_extended").exists()


def test_lazy_expiry_frees_unit(api, manager_a, unit):
    c = new_client(api, manager_a)
    bid = book(api, manager_a, unit, c["id"]).data["id"]
    Booking.objects.filter(pk=bid).update(expires_at=timezone.now() - timedelta(minutes=1))
    data = auth(api, manager_a).get(f"{BOOKINGS}{bid}/").data
    assert data["status"] == "expired"
    unit.refresh_from_db()
    assert unit.status == Unit.Status.AVAILABLE
    client = Client.objects.get(pk=c["id"])
    assert client.status == Client.Status.VISITED
    assert client.activities.filter(kind="booking_expired").exists()


def test_expire_command(api, manager_a, unit):
    c = new_client(api, manager_a)
    bid = book(api, manager_a, unit, c["id"]).data["id"]
    Booking.objects.filter(pk=bid).update(expires_at=timezone.now() - timedelta(hours=1))
    call_command("expire_bookings")
    assert Booking.objects.get(pk=bid).status == Booking.Status.EXPIRED


def test_client_with_two_bookings_stays_booked(api, manager_a, block_a):
    c = new_client(api, manager_a)
    u1, u2 = list(block_a.units.order_by("id")[:2])
    b1 = book(api, manager_a, u1, c["id"]).data["id"]
    book(api, manager_a, u2, c["id"])
    auth(api, manager_a).post(f"{BOOKINGS}{b1}/cancel/", {"reason": "Bittasini oldi"}, format="json")
    assert Client.objects.get(pk=c["id"]).status == Client.Status.BOOKED


def test_booked_unit_price_locked_and_bulk_skips(api, manager_a, director_a, block_a, unit):
    c = new_client(api, manager_a)
    book(api, manager_a, unit, c["id"])
    old = unit.price_per_m2
    res = auth(api, director_a).patch(f"/api/v1/units/{unit.id}/", {"price_per_m2": old + 1000}, format="json")
    assert res.status_code == 400
    auth(api, director_a).post("/api/v1/units/bulk-price/", {"block": block_a.id, "mode": "percent", "value": "10"}, format="json")
    unit.refresh_from_db()
    assert unit.price_per_m2 == old


def test_chessboard_hides_foreign_client_name(api, manager_a, manager2_a, director_a, unit, project_a):
    c = new_client(api, manager_a)
    book(api, manager_a, unit, c["id"])

    def find(user):
        data = auth(api, user).get(f"/api/v1/projects/{project_a.id}/chessboard/").data
        for b in data["blocks"]:
            for e in b["entrances"]:
                for f in e["floors"]:
                    for u in f["units"]:
                        if u["id"] == unit.id:
                            return u["booking"]

    assert find(manager_a)["client_name"] == "Karimov Aziz"
    assert find(manager2_a)["client_name"] is None
    assert find(director_a)["client_name"] == "Karimov Aziz"


def test_manager_bookings_list_scoped(api, manager_a, manager2_a, block_a):
    u1, u2 = list(block_a.units.order_by("id")[:2])
    c1 = new_client(api, manager_a)
    c2 = new_client(api, manager2_a, phone="+998931110088")
    book(api, manager_a, u1, c1["id"])
    book(api, manager2_a, u2, c2["id"])
    assert auth(api, manager_a).get(BOOKINGS).data["count"] == 1


def test_db_constraint_one_active_booking(manager_a, unit, company_a):
    from django.db import IntegrityError, transaction

    c = Client.objects.create(company=company_a, first_name="A", phone="+998931110099")
    kw = dict(company=company_a, unit=unit, client=c, expires_at=timezone.now() + timedelta(days=1), price_per_m2=1, total_price=1)
    Booking.objects.create(**kw)
    with pytest.raises(IntegrityError), transaction.atomic():
        Booking.objects.create(**kw)


def test_company_booking_days_editable_by_director(api, director_a, manager_a):
    assert auth(api, director_a).patch("/api/v1/company/", {"booking_days": 7}, format="json").data["booking_days"] == 7
    assert auth(api, director_a).patch("/api/v1/company/", {"booking_days": 31}, format="json").status_code == 400
    assert auth(api, manager_a).patch("/api/v1/company/", {"booking_days": 10}, format="json").status_code == 403
