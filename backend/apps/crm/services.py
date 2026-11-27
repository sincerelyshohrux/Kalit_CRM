"""Bron biznes-mantiqi.

Barcha o'zgarishlar tranzaksiyada va `select_for_update` bilan bajariladi:
ikki menejer bir vaqtda bitta xonadonni bron qila olmaydi (poyga holati yo'q),
qo'shimcha himoya — DB'dagi `one_active_booking_per_unit` cheklovi.
"""

from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.accounts.models import Role
from apps.realty.models import Unit

from .models import Booking, Client, ClientActivity

MAX_BOOKING_DAYS = 30


def max_days_for(user) -> int:
    """Direktor 30 kungacha, menejer — kompaniya sozlamasidagi muddatgacha bron qila oladi."""
    if user.role == Role.DIRECTOR:
        return MAX_BOOKING_DAYS
    return min(user.company.booking_days, MAX_BOOKING_DAYS)


def log(client, kind, author=None, text="", booking=None) -> ClientActivity:
    return ClientActivity.objects.create(
        company_id=client.company_id, client=client, kind=kind, author=author, text=text[:1000], booking=booking
    )


def can_manage_client(user, client) -> bool:
    """Menejer — o'z yoki hali biriktirilmagan mijozlari; direktor — hammasi."""
    if user.role == Role.DIRECTOR:
        return True
    if user.role == Role.MANAGER:
        return client.manager_id in (None, user.id)
    return False


def can_manage_booking(user, booking) -> bool:
    if user.role == Role.DIRECTOR:
        return True
    if user.role == Role.MANAGER:
        return booking.created_by_id == user.id or booking.client.manager_id == user.id
    return False


def _sync_client_after_close(client_id: int, author, text: str, kind, booking):
    client = Client.objects.select_for_update().get(pk=client_id)
    log(client, kind, author, text, booking)
    still_booked = Booking.objects.filter(client_id=client_id, status=Booking.Status.ACTIVE).exists()
    if client.status == Client.Status.BOOKED and not still_booked:
        client.status = Client.Status.VISITED
        client.save(update_fields=["status", "updated_at"])


def _free_unit(unit_id: int):
    unit = Unit.objects.select_for_update().get(pk=unit_id)
    if unit.status == Unit.Status.BOOKED:
        unit.status = Unit.Status.AVAILABLE
        unit.save(update_fields=["status", "updated_at"])


@transaction.atomic
def create_booking(*, unit: Unit, client: Client, user, days: int, note: str = "") -> Booking:
    limit = max_days_for(user)
    if not 1 <= days <= limit:
        raise ValidationError({"days": f"Bron muddati 1–{limit} kun bo'lishi mumkin."})
    if not can_manage_client(user, client):
        raise PermissionDenied("Bu mijoz boshqa menejerga biriktirilgan.")

    # Qulflash tartibi doim bir xil: avval xonadon, keyin mijoz — deadlock bo'lmasligi uchun
    unit = Unit.objects.select_for_update().get(pk=unit.pk)
    if unit.status != Unit.Status.AVAILABLE:
        raise ValidationError({"unit": f"Xonadon bron qilib bo'lmaydi: holati «{unit.get_status_display()}»."})
    client = Client.objects.select_for_update().get(pk=client.pk)

    booking = Booking.objects.create(
        company_id=unit.company_id,
        unit=unit,
        client=client,
        created_by=user,
        expires_at=timezone.now() + timedelta(days=days),
        price_per_m2=unit.price_per_m2,
        total_price=unit.total_price,
        note=note,
    )
    unit.status = Unit.Status.BOOKED
    unit.save(update_fields=["status", "updated_at"])

    fields = ["updated_at"]
    if client.status != Client.Status.CONTRACT:
        client.status = Client.Status.BOOKED
        client.reject_reason = ""
        fields += ["status", "reject_reason"]
    if client.manager_id is None and user.role == Role.MANAGER:
        client.manager = user
        fields.append("manager")
    client.save(update_fields=fields)

    log(client, ClientActivity.Kind.BOOKING_CREATED, user, f"{unit} · {days} kun", booking)
    return booking


def _lock_active(booking: Booking) -> Booking:
    locked = Booking.objects.select_for_update(of=("self",)).select_related("unit", "client").get(pk=booking.pk)
    if locked.status != Booking.Status.ACTIVE:
        raise ValidationError({"detail": "Bron faol emas."})
    return locked


@transaction.atomic
def cancel_booking(booking: Booking, user, reason: str) -> Booking:
    if not can_manage_booking(user, booking):
        raise PermissionDenied("Faqat o'zingiz qilgan bronni bekor qila olasiz.")
    booking = _lock_active(booking)
    booking.status = Booking.Status.CANCELLED
    booking.closed_at = timezone.now()
    booking.closed_by = user
    booking.cancel_reason = reason
    booking.save(update_fields=["status", "closed_at", "closed_by", "cancel_reason", "updated_at"])
    _free_unit(booking.unit_id)
    _sync_client_after_close(
        booking.client_id, user, f"{booking.unit} · {reason}", ClientActivity.Kind.BOOKING_CANCELLED, booking
    )
    return booking


@transaction.atomic
def extend_booking(booking: Booking, user, days: int) -> Booking:
    if not can_manage_booking(user, booking):
        raise PermissionDenied("Faqat o'zingiz qilgan bronni uzaytira olasiz.")
    booking = _lock_active(booking)
    now = timezone.now()
    new_expiry = max(booking.expires_at, now) + timedelta(days=days)
    limit = max_days_for(user)
    if days < 1 or new_expiry - now > timedelta(days=limit):
        raise ValidationError({"days": f"Bron muddati bugundan boshlab {limit} kundan oshmasligi kerak."})
    booking.expires_at = new_expiry
    booking.save(update_fields=["expires_at", "updated_at"])
    log(booking.client, ClientActivity.Kind.BOOKING_EXTENDED, user, f"{booking.unit} · +{days} kun", booking)
    return booking


def expire_overdue_bookings(company=None) -> int:
    """Muddati o'tgan bronlarni yopadi va xonadonlarni bo'shatadi. Qaytaradi: yopilganlar soni.

    So'rovlar ichida "dangasa" chaqiriladi (indeksli bitta EXISTS), cron uchun esa
    `manage.py expire_bookings` buyrug'i bor.
    """
    qs = Booking.objects.filter(status=Booking.Status.ACTIVE, expires_at__lte=timezone.now())
    if company is not None:
        qs = qs.filter(company=company)
    ids = list(qs.values_list("id", flat=True)[:500])
    done = 0
    for pk in ids:
        with transaction.atomic():
            booking = (
                Booking.objects.select_for_update(skip_locked=True, of=("self",))
                .select_related("unit")
                .filter(pk=pk, status=Booking.Status.ACTIVE, expires_at__lte=timezone.now())
                .first()
            )
            if booking is None:
                continue
            booking.status = Booking.Status.EXPIRED
            booking.closed_at = timezone.now()
            booking.save(update_fields=["status", "closed_at", "updated_at"])
            _free_unit(booking.unit_id)
            _sync_client_after_close(
                booking.client_id, None, str(booking.unit), ClientActivity.Kind.BOOKING_EXPIRED, booking
            )
            done += 1
    return done
