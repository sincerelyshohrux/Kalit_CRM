from .conftest import auth


def test_employees_only_from_own_company(api, director_a, manager_a, director_b):
    r = auth(api, director_a).get("/api/v1/employees/")
    phones = {u["phone"] for u in r.data["results"]}
    assert phones == {director_a.phone, manager_a.phone}


def test_cannot_access_other_company_employee(api, director_a, director_b):
    r = auth(api, director_a).get(f"/api/v1/employees/{director_b.id}/")
    assert r.status_code == 404


def test_director_creates_employee_in_own_company(api, director_a, company_a):
    r = auth(api, director_a).post("/api/v1/employees/", {
        "phone": "901000009", "first_name": "Yangi", "role": "manager", "password": "Kuchli-parol-1",
        # boshqa kompaniyaga yozishga urinish e'tiborsiz qoladi
        "company": 999,
    })
    assert r.status_code == 201, r.data
    assert r.data["phone"] == "+998901000009"
    assert company_a.users.filter(phone="+998901000009").exists()


def test_manager_cannot_create_employee(api, manager_a):
    r = auth(api, manager_a).post("/api/v1/employees/", {
        "phone": "+998901000010", "first_name": "X", "role": "manager", "password": "Kuchli-parol-1",
    })
    assert r.status_code == 403


def test_cannot_create_superadmin_via_employees(api, director_a):
    r = auth(api, director_a).post("/api/v1/employees/", {
        "phone": "+998901000011", "first_name": "X", "role": "superadmin", "password": "Kuchli-parol-1",
    })
    assert r.status_code == 400


def test_max_users_limit(api, director_a, manager_a, company_a):
    company_a.max_users = 2
    company_a.save()
    r = auth(api, director_a).post("/api/v1/employees/", {
        "phone": "+998901000012", "first_name": "X", "role": "manager", "password": "Kuchli-parol-1",
    })
    assert r.status_code == 400


def test_delete_deactivates_and_not_self(api, director_a, manager_a):
    auth(api, director_a)
    assert api.delete(f"/api/v1/employees/{manager_a.id}/").status_code == 204
    manager_a.refresh_from_db()
    assert manager_a.is_active is False
    assert api.delete(f"/api/v1/employees/{director_a.id}/").status_code == 400


def test_manager_cannot_edit_company(api, manager_a, director_a):
    assert auth(api, manager_a).patch("/api/v1/company/", {"name": "X"}).status_code == 403
    r = auth(api, director_a).patch("/api/v1/company/", {"name": "Yangi nom", "plan": "enterprise"})
    assert r.status_code == 200
    assert r.data["name"] == "Yangi nom" and r.data["plan"] == "trial"  # tarifni direktor o'zgartira olmaydi


def test_reactivation_respects_user_limit(api, director_a, manager_a, cashier_a, company_a):
    """Bloklangan xodimni qayta yoqish orqali tarif limitini aylanib o'tib bo'lmaydi."""
    from .conftest import auth, make_user
    from apps.accounts.models import Role

    auth(api, director_a)
    assert api.delete(f"/api/v1/employees/{cashier_a.id}/").status_code == 204
    make_user("+998901000008", Role.MANAGER, company_a)
    make_user("+998901000009", Role.MANAGER, company_a)  # limit (4) to'ldi
    res = api.patch(f"/api/v1/employees/{cashier_a.id}/", {"is_active": True}, format="json")
    assert res.status_code == 400
