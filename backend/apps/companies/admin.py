from django.contrib import admin
from django.db.models import Count, Q

from apps.accounts.models import User

from .models import Company


class UserInline(admin.TabularInline):
    model = User
    fields = ["phone", "first_name", "last_name", "role", "is_active"]
    readonly_fields = fields
    extra = 0
    can_delete = False
    show_change_link = True


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ["name", "inn", "city", "plan", "status", "subscription_until", "users_count", "created_at"]
    list_filter = ["status", "plan", "city"]
    search_fields = ["name", "legal_name", "inn", "phone"]
    inlines = [UserInline]
    actions = ["suspend", "activate"]

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(_users=Count("users", filter=Q(users__is_active=True)))

    @admin.display(description="xodimlar", ordering="_users")
    def users_count(self, obj):
        return obj._users

    @admin.action(description="Tanlanganlarni bloklash")
    def suspend(self, request, queryset):
        queryset.update(status=Company.Status.SUSPENDED)

    @admin.action(description="Tanlanganlarni faollashtirish")
    def activate(self, request, queryset):
        queryset.update(status=Company.Status.ACTIVE)
