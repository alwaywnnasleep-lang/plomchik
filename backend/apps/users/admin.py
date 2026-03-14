from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = [
        'username', 'last_name', 'first_name', 'rank',
        'role', 'org_unit', 'clearance_level', 'is_active',
    ]
    list_filter = ['role', 'rank', 'clearance_level', 'is_active', 'org_unit']
    search_fields = ['username', 'last_name', 'first_name']
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Служебные данные', {
            'fields': ('patronymic', 'rank', 'position', 'role', 'clearance_level', 'org_unit'),
        }),
    )