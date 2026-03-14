from rest_framework.permissions import BasePermission
from .services import can_manage_unit


class CanManageStructure(BasePermission):
    def has_permission(self, request, view):
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True
        return request.user.role in (
            'commander', 'deputy_commander', 'department_head',
        )

    def has_object_permission(self, request, view, obj):
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True
        return can_manage_unit(request.user, obj)