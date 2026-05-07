from rest_framework import serializers
from .models import KnowledgeDocument

class KnowledgeDocumentSerializer(serializers.ModelSerializer):
    # ФИКС: Используем метод для безопасного извлечения имени
    uploaded_by_name = serializers.SerializerMethodField()
    file_name = serializers.CharField(read_only=True)
    file_size = serializers.IntegerField(read_only=True)

    class Meta:
        model = KnowledgeDocument
        fields = [
            'id', 'title', 'description', 'category', 'file', 
            'file_name', 'file_size', 'uploaded_by', 'uploaded_by_name', 'created_at'
        ]
        read_only_fields = ['uploaded_by', 'created_at']

    def get_uploaded_by_name(self, obj):
        # Безопасная проверка: если пользователь существует, отдаем имя, иначе - заглушку
        if obj.uploaded_by:
            return getattr(obj.uploaded_by, 'full_name', str(obj.uploaded_by))
        return 'Удаленный пользователь'
    
    