from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter

from apps.accounts.views import ChangePasswordView, EmployeeViewSet, LoginView, LogoutView, MeView, RefreshView
from apps.crm.views import BookingViewSet, ClientViewSet, NotificationViewSet
from apps.public import views as public
from apps.public.og import public_html
from apps.companies.views import MyCompanyView, PlatformCompanyViewSet, PlatformStatsView
from apps.realty.views import BlockViewSet, LayoutViewSet, ProjectPhotoViewSet, ProjectViewSet, UnitViewSet

admin.site.site_header = "Kalit CRM — boshqaruv"
admin.site.site_title = "Kalit CRM"
admin.site.index_title = "Platforma ma'lumotlari"

router = DefaultRouter()
router.register("employees", EmployeeViewSet, basename="employee")
router.register("projects", ProjectViewSet, basename="project")
router.register("blocks", BlockViewSet, basename="block")
router.register("units", UnitViewSet, basename="unit")
router.register("photos", ProjectPhotoViewSet, basename="photo")
router.register("layouts", LayoutViewSet, basename="layout")
router.register("clients", ClientViewSet, basename="client")
router.register("bookings", BookingViewSet, basename="booking")
router.register("notifications", NotificationViewSet, basename="notification")
router.register("platform/companies", PlatformCompanyViewSet, basename="platform-company")

api_v1 = [
    # Auth
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/refresh/", RefreshView.as_view(), name="token-refresh"),
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    path("auth/me/", MeView.as_view(), name="me"),
    path("auth/change-password/", ChangePasswordView.as_view(), name="change-password"),
    # Kompaniya paneli
    path("company/", MyCompanyView.as_view(), name="my-company"),
    path("site-settings/", public.SiteSettingsView.as_view(), name="site-settings"),
    # Ommaviy sayt (login talab qilinmaydi)
    path("public/sites/<str:slug>/", public.SiteView.as_view(), name="public-site"),
    path("public/sites/<str:slug>/projects/<int:pk>/", public.ProjectView.as_view(), name="public-project"),
    path("public/sites/<str:slug>/projects/<int:pk>/chessboard/", public.ChessboardView.as_view(), name="public-chessboard"),
    path("public/sites/<str:slug>/units/<int:pk>/", public.UnitView.as_view(), name="public-unit"),
    path("public/sites/<str:slug>/leads/", public.LeadView.as_view(), name="public-lead"),
    # Platforma admini
    path("platform/stats/", PlatformStatsView.as_view(), name="platform-stats"),
    path("", include(router.urls)),
]

urlpatterns = [
    path(settings.ADMIN_URL, admin.site.urls),
    path("api/v1/", include(api_v1)),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# Ommaviy sahifalar uchun Open Graph meta bilan HTML (eng oxirida — boshqa marshrutlarni to'smasin)
urlpatterns += [
    re_path(
        r"^(?P<slug>[a-z0-9][a-z0-9-]{1,38}[a-z0-9])(?:/(?P<kind>loyiha|xonadon)/(?P<pk>\d{1,10}))?/?$",
        public_html,
        name="public-html",
    ),
]
