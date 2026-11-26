from django.test import override_settings

from .conftest import PASSWORD, auth


@override_settings(LOGIN_MAX_ATTEMPTS=3)
def test_login_lockout_after_failed_attempts(api, director_a):
    for _ in range(3):
        assert api.post("/api/v1/auth/login/", {"phone": director_a.phone, "password": "xato"}).status_code == 401
    # to'g'ri parol bilan ham bloklangan
    r = api.post("/api/v1/auth/login/", {"phone": director_a.phone, "password": PASSWORD})
    assert r.status_code == 429


def test_successful_login_resets_counter(api, director_a):
    api.post("/api/v1/auth/login/", {"phone": director_a.phone, "password": "xato"})
    assert api.post("/api/v1/auth/login/", {"phone": director_a.phone, "password": PASSWORD}).status_code == 200


def test_unknown_phone_same_error_as_wrong_password(api, director_a):
    a = api.post("/api/v1/auth/login/", {"phone": "+998999999999", "password": "x"})
    b = api.post("/api/v1/auth/login/", {"phone": director_a.phone, "password": "x"})
    assert a.status_code == b.status_code == 401
    assert a.data == b.data


def _login(api, user):
    return api.post("/api/v1/auth/login/", {"phone": user.phone, "password": PASSWORD}).data


def test_password_change_revokes_old_tokens(api, manager_a):
    t = _login(api, manager_a)
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {t['access']}")
    assert api.post("/api/v1/auth/change-password/", {"old_password": PASSWORD, "new_password": "Yangi-parol-456"}).status_code == 204
    # eski access token endi ishlamaydi
    assert api.get("/api/v1/auth/me/").status_code == 401
    # eski refresh ham
    api.credentials()
    assert api.post("/api/v1/auth/refresh/", {"refresh": t["refresh"]}).status_code == 401


def test_blocked_employee_tokens_revoked(api, director_a, manager_a):
    t = _login(api, manager_a)
    auth(api, director_a).delete(f"/api/v1/employees/{manager_a.id}/")
    api.force_authenticate(None)
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {t['access']}")
    assert api.get("/api/v1/auth/me/").status_code == 401
    api.credentials()
    assert api.post("/api/v1/auth/refresh/", {"refresh": t["refresh"]}).status_code == 401


def test_cannot_logout_someone_elses_token(api, manager_a, director_a):
    other = _login(api, director_a)
    r = auth(api, manager_a).post("/api/v1/auth/logout/", {"refresh": other["refresh"]})
    assert r.status_code == 400


def test_anonymous_cannot_read_data(api, block_a):
    assert api.get("/api/v1/projects/").status_code == 401
    assert api.get("/api/v1/units/").status_code == 401


def test_invalid_image_rejected(api, director_a):
    from django.core.files.uploadedfile import SimpleUploadedFile

    fake = SimpleUploadedFile("logo.png", b"<?php echo 1; ?>", content_type="image/png")
    r = auth(api, director_a).patch("/api/v1/company/", {"logo": fake}, format="multipart")
    assert r.status_code == 400


WEB = {"HTTP_X_KALIT_CLIENT": "web"}


def test_web_login_sets_httponly_cookie_not_body(api, manager_a):
    r = api.post("/api/v1/auth/login/", {"phone": manager_a.phone, "password": PASSWORD}, **WEB)
    assert r.status_code == 200
    assert "refresh" not in r.data and "access" in r.data
    c = r.cookies["kalit_refresh"]
    assert c["httponly"] and c["samesite"] == "Strict" and c["path"] == "/api/v1/auth/"


def test_web_refresh_rotates_cookie_and_logout_clears(api, manager_a):
    api.post("/api/v1/auth/login/", {"phone": manager_a.phone, "password": PASSWORD}, **WEB)
    old = api.cookies["kalit_refresh"].value
    r = api.post("/api/v1/auth/refresh/", **WEB)
    assert r.status_code == 200 and "access" in r.data and "refresh" not in r.data
    new = api.cookies["kalit_refresh"].value
    assert new and new != old
    assert api.post("/api/v1/auth/logout/", **WEB).status_code == 205
    assert api.cookies["kalit_refresh"].value == ""
    # chiqib ketgandan keyin refresh ishlamaydi
    api.cookies["kalit_refresh"] = new
    assert api.post("/api/v1/auth/refresh/", **WEB).status_code == 401


def test_cookie_ignored_without_client_header(api, manager_a):
    """CSRF himoyasi: maxsus sarlavhasiz so'rov cookie'dan foydalana olmaydi."""
    api.post("/api/v1/auth/login/", {"phone": manager_a.phone, "password": PASSWORD}, **WEB)
    assert api.post("/api/v1/auth/refresh/").status_code == 401
