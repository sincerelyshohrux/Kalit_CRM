from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ["-date_joined"]
    list_display = ["phone", "full_name", "role", "company", "is_active", "last_login"]
    list_filter = ["role", "is_active", "company"]
    search_fields = ["phone", "first_name", "last_name", "email"]
    autocomplete_fields = ["company"]
    readonly_fields = ["last_login", "date_joined"]

    fieldsets = (
        (None, {"fields": ("phone", "password")}),
        ("Shaxsiy ma'lumotlar", {"fields": ("first_name", "last_name", "email", "avatar")}),
        ("Kompaniya va rol", {"fields": ("company", "role")}),
        ("Ruxsatlar", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Sanalar", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("phone", "first_name", "last_name", "company", "role", "password1", "password2"),
        }),
    )
