from rest_framework.permissions import BasePermission
from apps.structure.services import is_subordinate, get_units_under_authority


class CanCreateTask(BasePermission):
    def has_permission(self, request, view):
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True
        return request.user.role in (
            'commander', 'deputy_commander',
            'department_head', 'group_head',
        )


class CanManageTask(BasePermission):
    def has_object_permission(self, request, view, obj):
        user = request.user
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            if obj.assigned_to == user or obj.created_by == user:
                return True
            if obj.org_unit_id:
                return obj.org_unit_id in get_units_under_authority(user)
            return False
        if obj.created_by == user:
            return True
        if obj.assigned_to == user and request.method == 'PATCH':
            return True
        if obj.org_unit_id:
            return obj.org_unit_id in get_units_under_authority(user)
        return False


class CanAssignTo(BasePermission):
    def has_permission(self, request, view):
        if request.method not in ('POST', 'PUT', 'PATCH'):
            return True
        assigned_to_id = request.data.get('assigned_to')
        if not assigned_to_id:
            return True
        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            target = User.objects.get(id=assigned_to_id)
        except User.DoesNotExist:
            return False
        return is_subordinate(request.user, target)