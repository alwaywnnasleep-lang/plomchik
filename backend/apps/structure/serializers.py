from rest_framework import serializers
from django.contrib.auth import get_user_model

from .models import OrgUnit, StructureChange
from apps.users.serializers import UserShortSerializer

User = get_user_model()


class OrgUnitTreeSerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField()
    commander_detail = UserShortSerializer(source='commander', read_only=True)
    personnel_list = UserShortSerializer(
        source='personnel', many=True, read_only=True,
    )
    personnel_count = serializers.IntegerField(read_only=True)
    total_personnel_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = OrgUnit
        fields = [
            'id', 'name', 'unit_type', 'parent', 'commander',
            'commander_detail', 'order', 'children',
            'personnel_list', 'personnel_count', 'total_personnel_count',
            'created_at', 'updated_at',
        ]

    def get_children(self, obj):
        children = obj.children.all().order_by('order', 'name')
        return OrgUnitTreeSerializer(children, many=True, context=self.context).data


class OrgUnitWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrgUnit
        fields = ['id', 'name', 'unit_type', 'parent', 'commander', 'order']


class StructureChangeSerializer(serializers.ModelSerializer):
    changed_by_name = serializers.CharField(
        source='changed_by.short_name', read_only=True, default='',
    )
    change_type_display = serializers.CharField(
        source='get_change_type_display', read_only=True,
    )

    class Meta:
        model = StructureChange
        fields = [
            'id', 'org_unit_name', 'org_unit', 'change_type',
            'change_type_display', 'description',
            'old_data', 'new_data',
            'changed_by', 'changed_by_name', 'created_at',
        ]
        read_only_fields = ['changed_by', 'created_at']


class MovePersonnelSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()
    target_unit_id = serializers.IntegerField()

    def validate_user_id(self, value):
        if not User.objects.filter(id=value, is_active=True).exists():
            raise serializers.ValidationError('Пользователь не найден.')
        return value

    def validate_target_unit_id(self, value):
        if not OrgUnit.objects.filter(id=value).exists():
            raise serializers.ValidationError('Подразделение не найдено.')
        return value