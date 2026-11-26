import pytest
from rest_framework.test import APIClient

from apps.accounts.models import Role, User
from apps.companies.models import Company

PASSWORD = "Test-parol-123"


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
