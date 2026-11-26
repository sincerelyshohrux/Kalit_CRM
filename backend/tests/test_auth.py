from datetime import timedelta

from django.utils import timezone

from apps.companies.models import Company

from .conftest import PASSWORD


def test_login_with_any_phone_format(api, director_a):
    r = api.post("/api/v1/auth/login/", {"phone": "90 100-00-01", "password": PASSWORD})
    assert r.status_code == 200, r.data
    assert {"access", "refresh", "user"} <= r.data.keys()
    assert r.data["user"]["role"] == "director"
    assert r.data["user"]["company"]["name"] == "A Qurilish"


def test_login_wrong_password(api, director_a):
    r = api.post("/api/v1/auth/login/", {"phone": "+998901000001", "password": "xato-parol"})
    assert r.status_code == 401


def test_login_blocked_for_suspended_company(api, director_a, company_a):
    company_a.status = Company.Status.SUSPENDED
    company_a.save()
    r = api.post("/api/v1/auth/login/", {"phone": "+998901000001", "password": PASSWORD})
    assert r.status_code == 400


def test_expired_subscription_blocks_api(api, director_a, company_a):
    company_a.subscription_until = timezone.localdate() - timedelta(days=1)
    company_a.save()
    api.force_authenticate(director_a)
    assert api.get("/api/v1/employees/").status_code == 403


def test_me_and_refresh_and_logout(api, manager_a):
    tokens = api.post("/api/v1/auth/login/", {"phone": "+998901000002", "password": PASSWORD}).data
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    me = api.get("/api/v1/auth/me/")
    assert me.status_code == 200 and me.data["phone"] == "+998901000002"

    refreshed = api.post("/api/v1/auth/refresh/", {"refresh": tokens["refresh"]})
    assert refreshed.status_code == 200
    assert api.post("/api/v1/auth/logout/", {"refresh": refreshed.data["refresh"]}).status_code == 205
    # chiqib ketilgan refresh token qayta ishlamaydi
    assert api.post("/api/v1/auth/refresh/", {"refresh": refreshed.data["refresh"]}).status_code == 401


def test_change_password(api, manager_a):
    api.force_authenticate(manager_a)
    r = api.post("/api/v1/auth/change-password/", {"old_password": PASSWORD, "new_password": "Yangi-parol-456"})
    assert r.status_code == 204
    manager_a.refresh_from_db()
    assert manager_a.check_password("Yangi-parol-456")
