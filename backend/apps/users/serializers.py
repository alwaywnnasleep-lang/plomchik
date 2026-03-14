from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import User

class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name', 'patronymic',
            'full_name', 'rank', 'position', 'role', 'clearance_level',
            'org_unit', 'is_active', 'date_joined'
        ]
        read_only_fields = ['date_joined']
    
    def get_full_name(self, obj):
        return obj.full_name


class UserDetailSerializer(UserSerializer):
    org_unit_name = serializers.CharField(source='org_unit.name', read_only=True)
    
    class Meta(UserSerializer.Meta):
        fields = UserSerializer.Meta.fields + ['org_unit_name']


class UserShortSerializer(serializers.ModelSerializer):
    """Краткий сериализатор для списков пользователей"""
    full_name = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'full_name', 'rank', 'role', 'org_unit']
    
    def get_full_name(self, obj):
        return obj.full_name


class ChangePasswordSerializer(serializers.Serializer):
    """Сериализатор для смены пароля"""
    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True)
    confirm_password = serializers.CharField(required=True, write_only=True)
    
    def validate(self, data):
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError("Пароли не совпадают")
        return data


class LoginSerializer(serializers.Serializer):
    """Сериализатор для логина"""
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)
    
    def validate(self, data):
        username = data.get('username')
        password = data.get('password')
        
        if username and password:
            user = authenticate(username=username, password=password)
            if user:
                if not user.is_active:
                    raise serializers.ValidationError('Пользователь деактивирован')
                data['user'] = user
            else:
                raise serializers.ValidationError('Неверные учетные данные')
        else:
            raise serializers.ValidationError('Необходимо указать логин и пароль')
        
        return data