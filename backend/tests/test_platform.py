from apps.accounts.models import User

from .conftest import auth


def test_company_users_cannot_use_platform_api(api, director_a):
    assert auth(api, director_a).get("/api/v1/platform/companies/").status_code == 403
    assert api.get("/api/v1/platform/stats/").status_code == 403


def test_superadmin_creates_company_with_director(api, superadmin):
    r = auth(api, superadmin).post("/api/v1/platform/companies/", {
        "name": "Yangi Build", "inn": "123456789", "plan": "start",
        "director": {"first_name": "Bobur", "phone": "+998931234567", "password": "Kuchli-parol-1"},
    }, format="json")
    assert r.status_code == 201, r.data
    assert r.data["director_info"]["phone"] == "+998931234567"
    assert User.objects.get(phone="+998931234567").role == "director"


def test_create_company_requires_director(api, superadmin):
    r = auth(api, superadmin).post("/api/v1/platform/companies/", {"name": "X"}, format="json")
    assert r.status_code == 400


def test_suspend_and_activate(api, superadmin, company_a):
    auth(api, superadmin)
    assert api.post(f"/api/v1/platform/companies/{company_a.id}/suspend/").data["status"] == "suspended"
    assert api.post(f"/api/v1/platform/companies/{company_a.id}/activate/").data["status"] == "active"


def test_stats(api, superadmin, director_a, director_b):
    r = auth(api, superadmin).get("/api/v1/platform/stats/")
    assert r.status_code == 200
    assert r.data["companies_total"] == 2 and r.data["users_total"] == 2
