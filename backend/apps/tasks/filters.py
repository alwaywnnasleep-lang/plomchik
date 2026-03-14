import django_filters
from .models import Task


class TaskFilter(django_filters.FilterSet):
    status = django_filters.ChoiceFilter(choices=Task.Status.choices)
    priority = django_filters.ChoiceFilter(choices=Task.Priority.choices)
    org_unit = django_filters.NumberFilter(field_name='org_unit_id')
    assigned_to = django_filters.NumberFilter(field_name='assigned_to_id')
    created_by = django_filters.NumberFilter(field_name='created_by_id')
    deadline_from = django_filters.DateTimeFilter(
        field_name='deadline', lookup_expr='gte',
    )
    deadline_to = django_filters.DateTimeFilter(
        field_name='deadline', lookup_expr='lte',
    )
    is_root = django_filters.BooleanFilter(
        field_name='parent_task', lookup_expr='isnull',
    )
    tag = django_filters.CharFilter(method='filter_by_tag')

    class Meta:
        model = Task
        fields = [
            'status', 'priority', 'org_unit', 'assigned_to',
            'created_by', 'deadline_from', 'deadline_to', 'is_root', 'tag',
        ]

    def filter_by_tag(self, queryset, name, value):
        return queryset.filter(tags__contains=[value])