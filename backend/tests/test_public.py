from datetime import timedelta

import pytest
from django.utils import timezone

from apps.accounts.models import Role
from apps.companies.models import Company
from apps.crm.models import Booking, Client, ClientActivity, Notification
from apps.public.models import SiteSettings
from apps.realty.models import Unit

from .conftest import auth, make_user

pytestmark = pytest.mark.django_db

BASE = "/api/v1/public/sites/"


@pytest.fixture
def site(company_a, block_a):
    return SiteSettings.objects.create(company=company_a, slug="a-qurilish", is_enabled=True)


def lead(api, slug="a-qurilish", **data):
    payload = {"first_name": "Aziz", "last_name": "Karimov", "phone": "90 123 45 67", **data}
    return api.post(f"{BASE}{slug}/leads/", payload, format="json")


# ---------- Ko'rish ----------


def test_site_available_without_login(api, site, project_a):
    res = api.get(f"{BASE}a-qurilish/")
    assert res.status_code == 200
    assert res.data["company"]["name"] == "A Qurilish"
    assert [p["id"] for p in res.data["projects"]] == [project_a.id]
    assert res.data["projects"][0]["units_available"] == 30


def test_disabled_site_or_suspended_company_404(api, site, company_a):
    site.is_enabled = False
    site.save()
    assert api.get(f"{BASE}a-qurilish/").status_code == 404
    site.is_enabled = True
    site.save()
    company_a.status = Company.Status.SUSPENDED
    company_a.save()
    assert api.get(f"{BASE}a-qurilish/").status_code == 404
    assert lead(api).status_code == 404


def test_hidden_project_not_listed(api, site, project_a):
    project_a.show_on_site = False
    project_a.save()
    assert api.get(f"{BASE}a-qurilish/").data["projects"] == []
    assert api.get(f"{BASE}a-qurilish/projects/{project_a.id}/").status_code == 404
    assert api.get(f"{BASE}a-qurilish/projects/{project_a.id}/chessboard/").status_code == 404


def test_foreign_company_project_not_reachable(api, site, project_b):
    assert api.get(f"{BASE}a-qurilish/projects/{project_b.id}/").status_code == 404


def test_chessboard_hides_private_data(api, site, project_a, block_a, manager_a):
    units = list(block_a.units.order_by("id")[:3])
    Unit.objects.filter(pk=units[0].pk).update(status=Unit.Status.SOLD)
    client = Client.objects.create(company=project_a.company, first_name="Maxfiy", last_name="Mijoz", phone="+998931110000")
    Booking.objects.create(
        company=project_a.company, unit=units[1], client=client, created_by=manager_a,
        expires_at=timezone.now() + timedelta(days=1), price_per_m2=1, total_price=1,
    )
    Unit.objects.filter(pk=units[1].pk).update(status=Unit.Status.BOOKED, note="ichki izoh")

    res = api.get(f"{BASE}a-qurilish/projects/{project_a.id}/chessboard/")
    assert res.status_code == 200
    text = str(res.data)
    assert "Maxfiy" not in text and "ichki izoh" not in text and "booking" not in text
    cells = {u["id"]: u for b in res.data["blocks"] for e in b["entrances"] for f in e["floors"] for u in f["units"]}
    assert set(cells[units[0].id]) == {"id", "entrance", "floor", "position", "number", "unit_type", "rooms", "area", "layout_id", "match", "free", "total_price", "price_per_m2"}
    assert cells[units[0].id]["free"] is False and cells[units[0].id]["total_price"] is None
    assert cells[units[1].id]["free"] is False and cells[units[1].id]["total_price"] is None
    assert cells[units[2].id]["free"] is True and cells[units[2].id]["total_price"] > 0


def test_prices_hidden_when_disabled_and_price_filter_ignored(api, site, project_a, block_a):
    site.show_prices = False
    site.save()
    data = api.get(f"{BASE}a-qurilish/").data
    assert data["projects"][0]["min_price"] is None
    assert data["installment"]["enabled"] is False
    board = api.get(f"{BASE}a-qurilish/projects/{project_a.id}/chessboard/", {"price_max": 1}).data
    units = [u for b in board["blocks"] for e in b["entrances"] for f in e["floors"] for u in f["units"]]
    assert all(u["total_price"] is None for u in units)
    # narx filtri e'tiborsiz qoldiriladi — aks holda filtr orqali narxni topib olish mumkin
    assert board["summary"]["matched"] == board["summary"]["total"]
    unit = units[0]
    assert api.get(f"{BASE}a-qurilish/units/{unit['id']}/").data["total_price"] is None


def test_unit_page(api, site, block_a):
    u = block_a.units.first()
    data = api.get(f"{BASE}a-qurilish/units/{u.id}/").data
    assert data["number"] == u.number and data["free"] is True
    assert "note" not in data and "status" not in data


# ---------- Ariza ----------


def test_lead_creates_client_and_notifies(api, site, director_a, manager_a, block_a):
    u = block_a.units.first()
    res = lead(api, unit=u.id, message="Qachon ko'rsa bo'ladi?")
    assert res.status_code == 201
    client = Client.objects.get(phone="+998901234567")
    assert client.source == Client.Source.WEBSITE and client.status == Client.Status.NEW
    assert client.interested_project_id == block_a.project_id
    act = client.activities.get(kind="website")
    assert f"№{u.number}" in act.text and "Qachon" in act.text
    assert set(Notification.objects.values_list("user_id", flat=True)) == {director_a.id, manager_a.id}


def test_lead_merges_existing_client(api, site, director_a, manager_a):
    existing = Client.objects.create(
        company=site.company, first_name="Eski", phone="+998901234567", manager=manager_a,
        status=Client.Status.REJECTED, reject_reason="qimmat",
    )
    assert lead(api, message="Yana qiziqyapman").status_code == 201
    assert Client.objects.filter(company=site.company).count() == 1
    existing.refresh_from_db()
    assert existing.first_name == "Eski"  # saytdan kelgan ism mavjud ma'lumotni almashtirmaydi
    assert existing.status == Client.Status.NEW
    # faqat mas'ul menejerga
    assert list(Notification.objects.values_list("user_id", "kind")) == [(manager_a.id, "lead_repeat")]


def test_duplicate_lead_not_logged_twice(api, site, director_a):
    lead(api, message="salom")
    lead(api, message="salom")
    client = Client.objects.get(phone="+998901234567")
    assert client.activities.filter(kind="website").count() == 1
    assert Notification.objects.count() == 1


def test_lead_honeypot_silently_dropped(api, site, director_a):
    res = lead(api, website="http://spam.example")
    assert res.status_code == 201
    assert not Client.objects.exists()


@pytest.mark.parametrize("bad", [
    {"phone": "12345"},
    {"first_name": "<script>alert(1)</script>"},
    {"message": "arzon kredit http://spam.example"},
    {"unit": 999999},
    {"project": 999999},
])
def test_lead_validation(api, site, bad):
    assert lead(api, **bad).status_code == 400
    assert not Client.objects.exists()


def test_lead_for_foreign_unit_rejected(api, site, project_b):
    from decimal import Decimal

    from apps.realty import services as rs
    from apps.realty.models import Block

    b = Block.objects.create(project=project_b, name="X", floors_count=1, entrances_count=1, units_per_floor=1)
    rs.generate_units(b, [rs.LayoutItem(rooms=1, area=Decimal("40"))], 1_000_000, Decimal("0"))
    assert lead(api, unit=b.units.first().id).status_code == 400


def test_lead_rate_limited(api, site, director_a):
    codes = [lead(api, phone=f"+99890123450{i}").status_code for i in range(4)]
    assert codes[:3] == [201, 201, 201] and codes[3] == 429


def test_turnstile_required_when_configured(api, site, settings, monkeypatch):
    settings.TURNSTILE_SECRET_KEY = "secret"
    from apps.public import services

    monkeypatch.setattr(services, "verify_turnstile", lambda token, ip: token == "good")
    assert lead(api).status_code == 400
    assert lead(api, token="good").status_code == 201


# ---------- Sozlamalar ----------


def test_site_settings_director_only_write(api, director_a, manager_a, company_a):
    data = auth(api, director_a).get("/api/v1/site-settings/").data
    assert data["slug"] and data["is_enabled"] is False
    assert auth(api, manager_a).patch("/api/v1/site-settings/", {"is_enabled": True}, format="json").status_code == 403
    res = auth(api, director_a).patch("/api/v1/site-settings/", {"is_enabled": True, "slug": "yangi-uy", "telegram": "@kalit_uz"}, format="json")
    assert res.status_code == 200 and res.data["telegram"] == "kalit_uz"


@pytest.mark.parametrize("slug", ["app", "api", "ab", "-abc", "Abc", "a b c", "abc--d", "x" * 41])
def test_bad_slugs(api, director_a, slug):
    auth(api, director_a).get("/api/v1/site-settings/")
    assert auth(api, director_a).patch("/api/v1/site-settings/", {"slug": slug}, format="json").status_code == 400


def test_slug_unique_across_companies(api, director_a, director_b):
    auth(api, director_a).patch("/api/v1/site-settings/", {"slug": "band-manzil"}, format="json")
    assert auth(api, director_b).patch("/api/v1/site-settings/", {"slug": "band-manzil"}, format="json").status_code == 400


# ---------- Bildirishnomalar ----------


def test_notifications_own_only(api, site, director_a, manager_a):
    lead(api)
    data = auth(api, manager_a).get("/api/v1/notifications/").data
    assert data["unread"] == 1
    nid = data["results"][0]["id"]
    # boshqa xodimning bildirishnomasini o'qilgan qila olmaydi
    other = Notification.objects.get(user=director_a)
    auth(api, manager_a).post(f"/api/v1/notifications/{other.id}/read/")
    other.refresh_from_db()
    assert other.read_at is None
    auth(api, manager_a).post(f"/api/v1/notifications/{nid}/read/")
    assert auth(api, manager_a).get("/api/v1/notifications/").data["unread"] == 0


# ---------- Open Graph ----------


def test_og_html(client, site, project_a, settings, tmp_path):
    index = tmp_path / "index.html"
    index.write_text("<html><head><title>Kalit</title></head><body><div id=root></div></body></html>")
    settings.FRONTEND_INDEX = index
    settings.PUBLIC_BASE_URL = "https://kalit.uz"
    settings.ALLOWED_HOSTS = ["*"]  # Host sarlavhasi soxta bo'lsa ham havolalar PUBLIC_BASE_URL'dan olinadi
    project_a.name = 'Loyiha "<b>"'
    project_a.save()
    res = client.get(f"/a-qurilish/loyiha/{project_a.id}", HTTP_HOST="evil.example")
    html = res.content.decode()
    assert res.status_code == 200
    assert 'og:url" content="https://kalit.uz/a-qurilish/loyiha/' in html
    assert "<b>" not in html and "&lt;b&gt;" in html
    assert html.count("<title>") == 1
    assert client.get("/yoq-sayt/").status_code == 404
