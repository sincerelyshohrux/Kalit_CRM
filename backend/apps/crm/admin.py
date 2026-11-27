from django.contrib import admin

from .models import Booking, Client, ClientActivity


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ["__str__", "phone", "company", "status", "source", "manager", "created_at"]
    list_filter = ["status", "source", "company"]
    search_fields = ["first_name", "last_name", "phone"]
    raw_id_fields = ["manager", "created_by", "interested_project"]


@admin.register(ClientActivity)
class ClientActivityAdmin(admin.ModelAdmin):
    list_display = ["client", "kind", "author", "created_at"]
    list_filter = ["kind"]
    raw_id_fields = ["client", "author", "booking"]


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ["__str__", "client", "company", "status", "expires_at", "created_by"]
    list_filter = ["status", "company"]
    raw_id_fields = ["unit", "client", "created_by", "closed_by"]
    # Holat faqat API orqali (xonadon holati bilan birga) o'zgaradi
    readonly_fields = ["status", "unit", "price_per_m2", "total_price", "closed_at", "closed_by"]
