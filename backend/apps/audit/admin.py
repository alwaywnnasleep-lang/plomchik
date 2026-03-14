from django.contrib import admin
from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ['action', 'user', 'category', 'ip_address', 'created_at']
    list_filter = ['category', 'created_at']
    search_fields = ['action', 'ip_address']
    readonly_fields = [
        'user', 'action', 'category', 'ip_address',
        'user_agent', 'details', 'created_at',
    ]