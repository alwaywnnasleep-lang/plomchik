from django.contrib import admin
from .models import OrgUnit, StructureChange

@admin.register(OrgUnit)
class OrgUnitAdmin(admin.ModelAdmin):
    list_display = ['name', 'unit_type', 'commander', 'order']
    list_filter = ['unit_type']
    search_fields = ['name']
    raw_id_fields = ['parent', 'commander']
    ordering = ['order', 'name']

@admin.register(StructureChange)
class StructureChangeAdmin(admin.ModelAdmin):
    list_display = ['org_unit_name', 'change_type', 'changed_by', 'created_at']
    list_filter = ['change_type']
    readonly_fields = ['created_at']
    raw_id_fields = ['org_unit', 'changed_by']