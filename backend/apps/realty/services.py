"""Biznes mantiq: xonadonlarni generatsiya qilish va narxlarni o'zgartirish."""

from dataclasses import dataclass
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import Block, Layout, PriceChange, Unit, layout_name

MAX_UNITS_PER_BLOCK = 5000


@dataclass
class LayoutItem:
    rooms: int
    area: Decimal
    unit_type: str = Unit.UnitType.APARTMENT


def round_price(value: Decimal, step: int = 1000) -> int:
    """Narxni 1000 so'mgacha yaxlitlaydi."""
    return int((Decimal(value) / step).quantize(Decimal("1")) * step)


@transaction.atomic
def generate_units(
    block: Block,
    layout: list[LayoutItem],
    base_price_per_m2: int,
    floor_step_percent: Decimal = Decimal("0"),
) -> list[Unit]:
    """Blok uchun barcha xonadonlarni yaratadi.

    Raqamlash: podyezd bo'yicha, pastdan yuqoriga (1-podyezd 1-qavatdan boshlanadi).
    Narx: har qavat ko'tarilganda `floor_step_percent` foizga oshadi.
    """
    if len(layout) != block.units_per_floor:
        raise ValidationError({"layout": f"Planirovka {block.units_per_floor} ta xonadondan iborat bo'lishi kerak."})
    total = block.floors_count * block.entrances_count * block.units_per_floor
    if total > MAX_UNITS_PER_BLOCK:
        raise ValidationError({"detail": f"Bir blokda {MAX_UNITS_PER_BLOCK} tadan ortiq xonadon bo'lishi mumkin emas."})
    if block.units.exists():
        raise ValidationError({"detail": "Bu blokda xonadonlar allaqachon yaratilgan."})

    # Har bir planirovka turi uchun Layout (loyiha darajasida, takrorlanmaydi)
    layouts = [ensure_layout(block.project, item) for item in layout]

    units: list[Unit] = []
    number = 0
    for entrance in range(1, block.entrances_count + 1):
        for floor in range(block.start_floor, block.top_floor + 1):
            multiplier = 1 + (floor_step_percent / 100) * (floor - block.start_floor)
            price = round_price(Decimal(base_price_per_m2) * multiplier)
            for position, (item, layout_obj) in enumerate(zip(layout, layouts), start=1):
                number += 1
                units.append(
                    Unit(
                        company_id=block.company_id,
                        block=block,
                        entrance=entrance,
                        floor=floor,
                        position=position,
                        number=str(number),
                        unit_type=item.unit_type,
                        rooms=item.rooms,
                        area=item.area,
                        layout=layout_obj,
                        price_per_m2=price,
                        total_price=Unit.calc_total(item.area, price),
                    )
                )
    return Unit.objects.bulk_create(units, batch_size=500)


def ensure_layout(project, item: LayoutItem) -> Layout:
    obj, _ = Layout.objects.get_or_create(
        project=project,
        name=layout_name(item.unit_type, item.rooms, item.area),
        defaults={"company_id": project.company_id, "unit_type": item.unit_type, "rooms": item.rooms, "area": item.area},
    )
    return obj


class PriceMode:
    SET = "set"                  # 1 m² narxini aniq qiymatga o'rnatish
    PERCENT = "percent"          # foizga oshirish/kamaytirish (-50..+100)
    AMOUNT = "amount"            # 1 m² narxiga summa qo'shish/ayirish
    CHOICES = [SET, PERCENT, AMOUNT]


@transaction.atomic
def bulk_change_price(units_qs, mode: str, value: Decimal, user, reason: str = "") -> dict:
    """Tanlangan xonadonlar narxini o'zgartiradi. Bron/sotilganlar o'zgarmaydi (narx shartnomada qotgan).

    Har bir o'zgarish PriceChange jadvaliga yoziladi.
    """
    units = list(units_qs.select_for_update().exclude(status__in=Unit.LOCKED_STATUSES))
    changes, updated = [], []
    now = timezone.now()
    for unit in units:
        old_ppm, old_total = unit.price_per_m2, unit.total_price
        if mode == PriceMode.SET:
            new_ppm = int(value)
        elif mode == PriceMode.PERCENT:
            new_ppm = round_price(Decimal(old_ppm) * (1 + Decimal(value) / 100))
        else:
            new_ppm = int(old_ppm + Decimal(value))
        if new_ppm < 0:
            raise ValidationError({"value": "Narx manfiy bo'lib qoladi."})
        if new_ppm == old_ppm:
            continue
        unit.price_per_m2 = new_ppm
        unit.total_price = Unit.calc_total(unit.area, new_ppm)
        unit.updated_at = now
        updated.append(unit)
        changes.append(
            PriceChange(
                company_id=unit.company_id, unit=unit,
                old_price_per_m2=old_ppm, new_price_per_m2=new_ppm,
                old_total=old_total, new_total=unit.total_price,
                changed_by=user, reason=reason,
            )
        )
    Unit.objects.bulk_update(updated, ["price_per_m2", "total_price", "updated_at"], batch_size=500)
    PriceChange.objects.bulk_create(changes, batch_size=500)
    skipped = units_qs.filter(status__in=Unit.LOCKED_STATUSES).count()
    return {"updated": len(updated), "skipped_locked": skipped}


def record_price_change(unit: Unit, old_ppm: int, old_total: int, user, reason: str = "") -> None:
    if unit.price_per_m2 != old_ppm:
        PriceChange.objects.create(
            company_id=unit.company_id, unit=unit,
            old_price_per_m2=old_ppm, new_price_per_m2=unit.price_per_m2,
            old_total=old_total, new_total=unit.total_price,
            changed_by=user, reason=reason,
        )
