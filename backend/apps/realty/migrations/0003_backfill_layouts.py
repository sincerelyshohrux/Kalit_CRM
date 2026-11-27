"""Mavjud xonadonlar uchun planirovka (Layout) yozuvlarini yaratadi.

4-bosqichgacha yaratilgan xonadonlarda `layout` bo'sh — ularni (tur, xona, maydon)
bo'yicha guruhlab, har loyiha uchun Layout yaratamiz va bog'laymiz.
"""

from decimal import Decimal

from django.db import migrations

LABELS = {"commercial": "Tijorat", "parking": "Avtoturargoh", "storage": "Ombor"}


def name_for(unit_type, rooms, area):
    area_txt = f"{Decimal(area).normalize():f}"
    if unit_type != "apartment":
        return f"{LABELS.get(unit_type, unit_type)} · {area_txt} m²"
    return f"{'Studiya' if rooms == 0 else f'{rooms} xonali'} · {area_txt} m²"


def forwards(apps, schema_editor):
    Unit = apps.get_model("realty", "Unit")
    Layout = apps.get_model("realty", "Layout")
    groups = (
        Unit.objects.filter(layout__isnull=True)
        .values_list("block__project_id", "block__project__company_id", "unit_type", "rooms", "area")
        .distinct()
    )
    for project_id, company_id, unit_type, rooms, area in groups:
        layout, _ = Layout.objects.get_or_create(
            project_id=project_id,
            name=name_for(unit_type, rooms, area),
            defaults={"company_id": company_id, "unit_type": unit_type, "rooms": rooms, "area": area},
        )
        Unit.objects.filter(
            block__project_id=project_id, unit_type=unit_type, rooms=rooms, area=area, layout__isnull=True
        ).update(layout=layout)


class Migration(migrations.Migration):
    dependencies = [("realty", "0002_photos_layouts_location")]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
