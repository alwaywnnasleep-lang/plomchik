from rest_framework.permissions import BasePermission
from apps.structure.services import is_subordinate, get_units_under_authority


class CanCreateTask(BasePermission):
    def has_permission(self, request, view):
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True
        if not request.user.is_authenticated:
            return False
        return request.user.role in ('commander', 'deputy_commander', 'department_head', 'group_head')

class CanManageTask(BasePermission):
    def has_permission(self, request, view):
        # Для списка задач тоже нужна проверка
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True
        if not request.user.is_authenticated:
            return False
        return True  # или своя логика

    def has_object_permission(self, request, view, obj):
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            if obj.assigned_to == request.user or obj.created_by == request.user:
                return True
            if obj.org_unit_id and obj.org_unit_id in get_units_under_authority(request.user):
                return True
            return False
        if not request.user.is_authenticated:
            return False
        if obj.created_by == request.user:
            return True
        if obj.assigned_to == request.user and request.method == 'PATCH':
            return True
        if obj.org_unit_id and obj.org_unit_id in get_units_under_authority(request.user):
            return True
        return False

class CanAssignTo(BasePermission):
    def has_permission(self, request, view):
        if request.method not in ('POST', 'PUT', 'PATCH'):
            return True
        if not request.user.is_authenticated:
            return False
        assigned_to_id = request.data.get('assigned_to')
        if not assigned_to_id:
            return True
        try:
            target = User.objects.get(id=assigned_to_id)
        except User.DoesNotExist:
            return False
        return is_subordinate(request.user, target)

class CanCommentOnTask(BasePermission):
    def has_permission(self, request, view):
        if request.method == 'GET':
            return True
        if not request.user.is_authenticated:
            return False
        task_id = view.kwargs.get('task_pk')
        if not task_id:
            return False
        from .models import Task
        try:
            task = Task.objects.get(pk=task_id)
        except Task.DoesNotExist:
            return False
        return self._has_access(request.user, task)

    def has_object_permission(self, request, view, obj):
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return self._has_access(request.user, obj.task)
        if not request.user.is_authenticated:
            return False
        return obj.user == request.user

    def _has_access(self, user, task):
        if not user.is_authenticated:
            return False
        if user.role in ('commander', 'deputy_commander'):
            return True
        if task.assigned_to == user or task.created_by == user:
            return True
        if task.org_unit_id:
            return task.org_unit_id in get_units_under_authority(user)
        return False

class CanSubmitTask(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        task_id = view.kwargs.get('pk')
        if not task_id:
            return False
        from .models import Task
        try:
            task = Task.objects.get(pk=task_id)
        except Task.DoesNotExist:
            return False
        return request.user == task.assigned_to and task.status == Task.Status.IN_PROGRESS

class CanReviewTask(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        task_id = view.kwargs.get('pk')
        if not task_id:
            return False
        from .models import Task
        try:
            task = Task.objects.get(pk=task_id)
        except Task.DoesNotExist:
            return False
        user = request.user
        if user.role in ('commander', 'deputy_commander'):
            return True
        if task.created_by == user:
            return True
        if task.org_unit_id:
            return task.org_unit_id in get_units_under_authority(user)
        return False