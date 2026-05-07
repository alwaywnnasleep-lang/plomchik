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
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True
        if not request.user.is_authenticated:
            return False
        return True

    def has_object_permission(self, request, view, obj):
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            if obj.assigned_to == request.user or obj.created_by == request.user:
                return True
            if obj.org_unit_id and obj.org_unit_id in get_units_under_authority(request.user):
                return True
            if obj.org_unit_id and hasattr(request.user, 'org_unit_id') and obj.org_unit_id == request.user.org_unit_id:
                return True
            return False
            
        if not request.user.is_authenticated:
            return False
            
        # ФИКС: ЗАПРЕЩАЕМ РЯДОВЫМ ЗАКРЫВАТЬ ЗАДАЧУ БЕЗ ПРОВЕРКИ
        if request.method in ('PATCH', 'PUT'):
            if 'status' in request.data:
                new_status = request.data['status']
                user = request.user
                is_leader = user.role in ('commander', 'deputy_commander', 'department_head', 'group_head')
                is_creator = obj.created_by == user
                
                # Если ты не начальник и не создатель задачи — тебе нельзя переводить в review или done вручную!
                # (Для этого есть специальные эндпоинты Submit и Approve)
                if not (is_leader or is_creator):
                    if new_status in ('done', 'review'):
                        return False

        if obj.created_by == request.user:
            return True
        if obj.assigned_to == request.user and request.method == 'PATCH':
            return True
        if obj.org_unit_id and obj.org_unit_id in get_units_under_authority(request.user):
            return True
        if request.method == 'PATCH' and obj.org_unit_id and hasattr(request.user, 'org_unit_id') and obj.org_unit_id == request.user.org_unit_id:
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
            
        # ФИКС: Разрешаем пользователю назначить задачу на самого себя (Взять в работу)
        if str(assigned_to_id) == str(request.user.id):
            return True
            
        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            target = User.objects.get(id=assigned_to_id)
        except User.DoesNotExist:
            return False
            
        from apps.structure.services import is_subordinate
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
            if task.org_unit_id in get_units_under_authority(user):
                return True
            if hasattr(user, 'org_unit_id') and task.org_unit_id == user.org_unit_id:
                return True
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
        return request.user == task.assigned_to and task.status in ('in_progress', 'todo')

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