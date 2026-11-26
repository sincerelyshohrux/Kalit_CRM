import pytest
from rest_framework.test import APIClient

from apps.accounts.models import Role, User
from apps.companies.models import Company

PASSWORD = "Test-parol-123"


@pytest.fixture(autouse=True)
def _fast_and_clean(settings):
    from django.core.cache import cache

    settings.PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def company_a(db):
    return Company.objects.create(name="A Qurilish", max_users=4)


@pytest.fixture
def company_b(db):
    return Company.objects.create(name="B Qurilish")


def make_user(phone, role, company=None):
    if role == Role.SUPERADMIN:
        return User.objects.create_superuser(phone, PASSWORD, first_name="Admin")
    return User.objects.create_user(phone, PASSWORD, first_name=role, role=role, company=company)


@pytest.fixture
def superadmin(db):
    return make_user("+998900000001", Role.SUPERADMIN)


@pytest.fixture
def director_a(company_a):
    return make_user("+998901000001", Role.DIRECTOR, company_a)


@pytest.fixture
def manager_a(company_a):
    return make_user("+998901000002", Role.MANAGER, company_a)


@pytest.fixture
def director_b(company_b):
    return make_user("+998902000001", Role.DIRECTOR, company_b)


def auth(api, user):
    api.force_authenticate(user)
    return api


@pytest.fixture
def cashier_a(company_a):
    return make_user("+998901000003", Role.CASHIER, company_a)


GEN = {
    "layout": [{"rooms": 1, "area": "40.00"}, {"rooms": 2, "area": "60.50"}, {"rooms": 3, "area": "85.00"}],
    "base_price_per_m2": 10_000_000,
    "floor_step_percent": "1.00",
}


@pytest.fixture
def project_a(company_a):
    from apps.realty.models import Project

    return Project.objects.create(company=company_a, name="Yangi Hayot")


@pytest.fixture
def block_a(project_a):
    from apps.realty import services
    from apps.realty.models import Block

    block = Block.objects.create(project=project_a, name="A", floors_count=5, entrances_count=2, units_per_floor=3)
    services.generate_units(
        block, [services.LayoutItem(rooms=i["rooms"], area=__import__("decimal").Decimal(i["area"])) for i in GEN["layout"]],
        GEN["base_price_per_m2"], __import__("decimal").Decimal(GEN["floor_step_percent"]),
    )
    return block


@pytest.fixture
def project_b(company_b):
    from apps.realty.models import Project

    return Project.objects.create(company=company_b, name="Begona loyiha")
