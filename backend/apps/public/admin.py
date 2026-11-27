from django.contrib import admin

from .models import SiteSettings


@admin.register(SiteSettings)
class SiteSettingsAdmin(admin.ModelAdmin):
    list_display = ["slug", "company", "is_enabled", "show_prices", "updated_at"]
    list_filter = ["is_enabled", "show_prices"]
    search_fields = ["slug", "company__name"]
