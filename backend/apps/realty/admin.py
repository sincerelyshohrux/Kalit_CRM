from django.contrib import admin

from .models import Block, PriceChange, Project, Unit


class BlockInline(admin.TabularInline):
    model = Block
    fields = ["name", "floors_count", "entrances_count", "units_per_floor", "start_floor", "completion_date"]
    extra = 0
    show_change_link = True


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ["name", "company", "city", "housing_class", "status", "completion_date", "is_active"]
    list_filter = ["status", "housing_class", "is_active", "company"]
    search_fields = ["name", "address", "company__name"]
    inlines = [BlockInline]


@admin.register(Block)
class BlockAdmin(admin.ModelAdmin):
    list_display = ["name", "project", "company", "floors_count", "entrances_count", "units_per_floor"]
    list_filter = ["company"]
    search_fields = ["name", "project__name"]
    readonly_fields = ["company"]


@admin.register(Unit)
class UnitAdmin(admin.ModelAdmin):
    list_display = ["number", "block", "entrance", "floor", "rooms", "area", "price_per_m2", "total_price", "status"]
    list_filter = ["status", "unit_type", "rooms", "company"]
    search_fields = ["number", "block__name", "block__project__name"]
    readonly_fields = ["company", "total_price"]
    list_select_related = ["block", "block__project"]


@admin.register(PriceChange)
class PriceChangeAdmin(admin.ModelAdmin):
    list_display = ["unit", "old_price_per_m2", "new_price_per_m2", "changed_by", "created_at"]
    list_filter = ["company"]
    readonly_fields = [f.name for f in PriceChange._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
