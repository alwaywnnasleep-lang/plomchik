from rest_framework import serializers
from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    username = serializers.CharField(
        source='user.username', read_only=True, default='system',
    )
    user_full_name = serializers.CharField(
        source='user.short_name', read_only=True, default='Система',
    )
    category_display = serializers.CharField(
        source='get_category_display', read_only=True,
    )

    class Meta:
        model = AuditLog
        fields = [
            'id', 'user', 'username', 'user_full_name',
            'action', 'category', 'category_display',
            'ip_address', 'user_agent', 'details', 'created_at',
        ]