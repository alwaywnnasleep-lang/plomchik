from django.db.models import Q
from .models import OrgUnit

def get_units_under_authority(user):
    """
    Возвращает список ID подразделений, над которыми пользователь имеет власть
    """
    if not user or not user.is_authenticated:
        return []
    
    if user.role in ('commander', 'deputy_commander'):
        # Командир видит все подразделения
        return list(OrgUnit.objects.values_list('id', flat=True))
    
    # Находим подразделения, где пользователь является командиром
    commanded_units = OrgUnit.objects.filter(commander=user).values_list('id', flat=True)
    
    # Если пользователь - начальник отдела/группы, добавляем его подразделение
    if user.org_unit and user.role in ('department_head', 'group_head'):
        return list(commanded_units) + [user.org_unit.id]
    
    return list(commanded_units)


def is_subordinate(commander, target_user):
    """
    Проверяет, является ли target_user подчиненным commander
    """
    if commander.role not in ('commander', 'deputy_commander', 'department_head', 'group_head'):
        return False
    
    # Если у целевого пользователя нет подразделения
    if not target_user.org_unit:
        return False
    
    # Получаем все подразделения под властью командира
    unit_ids = get_units_under_authority(commander)
    
    # Проверяем, находится ли подразделение целевого пользователя в списке
    return target_user.org_unit_id in unit_ids


def can_manage_unit(user, unit):
    """
    Проверяет, может ли пользователь управлять подразделением
    """
    if not user or not user.is_authenticated:
        return False
    
    if user.role in ('commander', 'deputy_commander'):
        return True
    
    if user.role == 'department_head' and unit.unit_type == 'department':
        return unit.commander == user
    
    if user.role == 'group_head' and unit.unit_type == 'group':
        return unit.commander == user
    
    # Проверяем, является ли пользователь командиром этого подразделения
    if unit.commander == user:
        return True
    
    return False