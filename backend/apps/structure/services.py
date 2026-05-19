from django.db.models import Q
from .models import OrgUnit

def get_all_descendant_ids(unit_ids):
    """Рекурсивно собирает ID всех дочерних подразделений (включая переданные)."""
    if not unit_ids:
        return []
    unit_ids = [int(u) for u in unit_ids]
    children = OrgUnit.objects.filter(parent_id__in=unit_ids).values_list('id', flat=True)
    if children:
        return list(unit_ids) + get_all_descendant_ids(children)
    return list(unit_ids)

def get_units_under_authority(user):
    """
    Возвращает список ID подразделений, над которыми пользователь имеет власть.
    """
    if not user or not user.is_authenticated:
        return []

    if user.is_superuser:
        return list(OrgUnit.objects.values_list('id', flat=True))

    # Командиры и замы – видят абсолютно все подразделения
    if user.role in ('commander', 'deputy_commander'):
        return list(OrgUnit.objects.values_list('id', flat=True))

    # Начальники отделов/групп: видят своё подразделение + все дочерние
    if user.role in ('department_head', 'group_head') and user.org_unit:
        base_ids = [user.org_unit.id]
        return get_all_descendant_ids(base_ids)

    # Если пользователь командир какого-то подразделения (commander в OrgUnit)
    commanded_units = OrgUnit.objects.filter(commander=user).values_list('id', flat=True)
    if commanded_units:
        return get_all_descendant_ids(list(commanded_units))

    # Обычный сотрудник: видит только своё подразделение (если есть)
    if user.org_unit:
        return [user.org_unit.id]

    return []

def is_subordinate(commander, target_user):
    """Проверяет, является ли target_user подчинённым commander."""
    if commander.role not in ('commander', 'deputy_commander', 'department_head', 'group_head'):
        return False
    if not target_user.org_unit:
        return False
    unit_ids = get_units_under_authority(commander)
    return target_user.org_unit_id in unit_ids

def can_manage_unit(user, unit):
    """Проверяет, может ли пользователь управлять подразделением."""
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser or user.role in ('commander', 'deputy_commander'):
        return True
    if user.role == 'department_head' and unit.unit_type == 'department':
        return unit.commander == user
    if user.role == 'group_head' and unit.unit_type == 'group':
        return unit.commander == user
    if unit.commander == user:
        return True
    return False