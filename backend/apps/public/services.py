"""Saytdan kelgan arizalarni CRM'ga qabul qilish."""

import json
import logging
import urllib.parse
import urllib.request
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import Role, User
from apps.crm.models import Client, ClientActivity, Notification

logger = logging.getLogger("kalit.security")

TURNSTILE_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
# Bir xil raqamdan qisqa vaqt ichida takroriy ariza — yangi bildirishnoma yubormaymiz
REPEAT_WINDOW = timedelta(minutes=30)


def turnstile_enabled() -> bool:
    return bool(settings.TURNSTILE_SECRET_KEY)


def verify_turnstile(token: str, ip: str) -> bool:
    """Cloudflare Turnstile tokenini tekshiradi. Kalit sozlanmagan bo'lsa — o'tkazib yuboriladi."""
    if not turnstile_enabled():
        return True
    if not token or len(token) > 2048:
        return False
    data = urllib.parse.urlencode(
        {"secret": settings.TURNSTILE_SECRET_KEY, "response": token, "remoteip": ip}
    ).encode()
    try:
        with urllib.request.urlopen(urllib.request.Request(TURNSTILE_URL, data=data), timeout=5) as res:
            return bool(json.loads(res.read(4096)).get("success"))
    except Exception:  # tarmoq xatosi — xavfsiz tomonga: rad etamiz
        logger.warning("Turnstile tekshiruvi bajarilmadi")
        return False


def describe(project=None, unit=None) -> str:
    if unit is not None:
        rooms = "studiya" if unit.rooms == 0 else f"{unit.rooms} xonali"
        return f"{unit.block.project.name} · {unit.block.name} · №{unit.number} ({rooms}, {unit.area} m²)"
    if project is not None:
        return project.name
    return ""


def recipients(company, client) -> list[User]:
    """Bildirishnoma kimga: mas'ul menejerga, u bo'lmasa — direktor va barcha menejerlarga."""
    if client.manager_id and client.manager.is_active:
        return [client.manager]
    return list(User.objects.filter(company=company, is_active=True, role__in=[Role.DIRECTOR, Role.MANAGER]))


@transaction.atomic
def submit_lead(*, company, first_name, last_name, phone, project=None, unit=None, message="") -> Client:
    """Arizani mijozga aylantiradi. Telefon bazada bo'lsa — yangi mijoz ochilmaydi, tarixiga yoziladi."""
    client = Client.objects.select_for_update(of=("self",)).filter(company=company, phone=phone).select_related("manager").first()
    is_new = client is None
    target = describe(project, unit)
    text = " · ".join(p for p in (target, message) if p)[:1000]

    if is_new:
        client = Client.objects.create(
            company=company, first_name=first_name, last_name=last_name, phone=phone,
            source=Client.Source.WEBSITE, status=Client.Status.NEW,
            interested_project=unit.block.project if unit is not None else project,
            note=message,
        )
        ClientActivity.objects.create(company=company, client=client, kind=ClientActivity.Kind.CREATED, text="Sayt")
    else:
        recent = ClientActivity.objects.filter(
            client=client, kind=ClientActivity.Kind.WEBSITE, created_at__gte=timezone.now() - REPEAT_WINDOW
        )
        if recent.filter(text=text).exists():
            return client  # aynan shu ariza yaqinda yuborilgan — dublikat yozmaymiz
        fields = ["updated_at"]
        if client.status == Client.Status.REJECTED:
            # Rad etgan mijoz qaytib keldi — yana ishga olinadi
            client.status = Client.Status.NEW
            client.reject_reason = ""
            fields += ["status", "reject_reason"]
            ClientActivity.objects.create(
                company=company, client=client, kind=ClientActivity.Kind.STATUS, text="Rad etdi → Yangi (saytdan qayta ariza)"
            )
        if client.interested_project_id is None and (unit is not None or project is not None):
            client.interested_project = unit.block.project if unit is not None else project
            fields.append("interested_project")
        client.save(update_fields=fields)

    ClientActivity.objects.create(company=company, client=client, kind=ClientActivity.Kind.WEBSITE, text=text)

    kind = Notification.Kind.LEAD if is_new else Notification.Kind.LEAD_REPEAT
    title = f"Saytdan ariza: {client.full_name}" if is_new else f"Takroriy ariza: {client.full_name}"
    Notification.objects.bulk_create(
        Notification(company=company, user=u, kind=kind, title=title[:200], text=text[:500], client=client)
        for u in recipients(company, client)
    )
    return client
