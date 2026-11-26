import django_filters

from .models import Unit


class NumberInFilter(django_filters.BaseInFilter, django_filters.NumberFilter):
    pass


class CharInFilter(django_filters.BaseInFilter, django_filters.CharFilter):
    pass


class UnitFilter(django_filters.FilterSet):
    project = django_filters.NumberFilter(field_name="block__project")
    rooms = NumberInFilter(field_name="rooms")                  # ?rooms=1,2,3
    status = CharInFilter(field_name="status")                 # ?status=available,booked
    floor_min = django_filters.NumberFilter(field_name="floor", lookup_expr="gte")
    floor_max = django_filters.NumberFilter(field_name="floor", lookup_expr="lte")
    price_min = django_filters.NumberFilter(field_name="total_price", lookup_expr="gte")
    price_max = django_filters.NumberFilter(field_name="total_price", lookup_expr="lte")
    area_min = django_filters.NumberFilter(field_name="area", lookup_expr="gte")
    area_max = django_filters.NumberFilter(field_name="area", lookup_expr="lte")

    class Meta:
        model = Unit
        fields = ["block", "entrance", "unit_type", "finishing"]
