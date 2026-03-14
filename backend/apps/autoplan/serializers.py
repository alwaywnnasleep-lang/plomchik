from rest_framework import serializers
from .models import ParsedDocument


class ParsedDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParsedDocument
        fields = [
            'id', 'filename', 'file_type', 'status',
            'parsed_data', 'error_message',
            'uploaded_by', 'created_at',
        ]
        read_only_fields = [
            'filename', 'file_type', 'status',
            'parsed_data', 'error_message',
            'uploaded_by', 'created_at',
        ]


class DocumentUploadSerializer(serializers.Serializer):
    file = serializers.FileField()

    def validate_file(self, value):
        allowed = ['docx', 'doc', 'pdf', 'xlsx', 'xls']
        ext = value.name.rsplit('.', 1)[-1].lower() if '.' in value.name else ''
        if ext not in allowed:
            raise serializers.ValidationError(
                f'Допустимые форматы: {", ".join(allowed)}'
            )
        if value.size > 52428800:
            raise serializers.ValidationError('Максимальный размер — 50 МБ.')
        return value


class GenerateTasksSerializer(serializers.Serializer):
    selected_indices = serializers.ListField(
        child=serializers.IntegerField(min_value=0),
    )
    priority = serializers.ChoiceField(
        choices=['critical', 'high', 'medium', 'low'],
        default='medium',
    )
    org_unit_id = serializers.IntegerField(required=False, allow_null=True)