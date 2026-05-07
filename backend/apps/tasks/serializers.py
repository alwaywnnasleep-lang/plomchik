from rest_framework import serializers
from .models import (
    Task, TaskAttachment, TaskComment, CommentAttachment,
    TaskSubmission, SubmissionAttachment
)
from apps.users.serializers import UserShortSerializer

# ==========================================
# 1. ЗАВИСИМЫЕ СЕРИАЛИЗАТОРЫ 
# ==========================================

class TaskAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = TaskAttachment
        fields = ['id', 'file', 'filename', 'uploaded_by', 'uploaded_by_name', 'created_at']
        read_only_fields = ['uploaded_by', 'created_at']

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return getattr(obj.uploaded_by, 'full_name', getattr(obj.uploaded_by, 'short_name', str(obj.uploaded_by)))
        return 'Неизвестно'


class CommentAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = CommentAttachment
        fields = ['id', 'file', 'filename', 'uploaded_by', 'uploaded_by_name', 'created_at']
        read_only_fields = ['uploaded_by', 'created_at']

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return getattr(obj.uploaded_by, 'full_name', getattr(obj.uploaded_by, 'short_name', str(obj.uploaded_by)))
        return 'Неизвестно'


class CommentSerializer(serializers.ModelSerializer):
    user_full_name = serializers.SerializerMethodField()
    user_rank = serializers.CharField(source='user.rank', read_only=True, default='')
    attachments = CommentAttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = TaskComment
        fields = ['id', 'task', 'user', 'user_full_name', 'user_rank', 'text', 'attachments', 'created_at']
        read_only_fields = ['user', 'created_at', 'task']

    def get_user_full_name(self, obj):
        if obj.user:
            return getattr(obj.user, 'full_name', getattr(obj.user, 'short_name', str(obj.user)))
        return 'Неизвестно'


class CommentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskComment
        # ФИКС: Добавили id и created_at, чтобы фронтенд мог прикреплять файлы
        fields = ['id', 'text', 'created_at'] 
        read_only_fields = ['id', 'created_at']


class SubmissionAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = SubmissionAttachment
        fields = ['id', 'file', 'filename', 'uploaded_by', 'uploaded_by_name', 'created_at']
        read_only_fields = ['uploaded_by', 'created_at']

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return getattr(obj.uploaded_by, 'full_name', getattr(obj.uploaded_by, 'short_name', str(obj.uploaded_by)))
        return 'Неизвестно'


class TaskSubmissionSerializer(serializers.ModelSerializer):
    files = SubmissionAttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = TaskSubmission
        fields = [
            'id', 'status', 'comment', 'submitted_at',
            'reviewed_by', 'reviewed_at', 'review_comment', 'files'
        ]


class SubtaskSerializer(serializers.ModelSerializer):
    assigned_to_detail = UserShortSerializer(source='assigned_to', read_only=True)
    done = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            'id', 'title', 'status', 'priority',
            'assigned_to', 'assigned_to_detail', 'deadline', 'done',
        ]

    def get_done(self, obj):
        return obj.status == 'done'

# ==========================================
# 2. ГЛАВНЫЕ СЕРИАЛИЗАТОРЫ
# ==========================================

class TaskListSerializer(serializers.ModelSerializer):
    assignee_detail = UserShortSerializer(source='assigned_to', read_only=True)
    creator_detail = UserShortSerializer(source='created_by', read_only=True)
    tags = serializers.JSONField(required=False, default=list)
    submission = serializers.SerializerMethodField()
    
    # ДОБАВЛЕНО: Теперь бэкенд отдает эти данные сразу при загрузке доски
    subtasks = SubtaskSerializer(many=True, read_only=True)
    attachments = TaskAttachmentSerializer(many=True, read_only=True)
    comments = CommentSerializer(many=True, read_only=True)

    class Meta:
        model = Task
        fields = [
            'id', 'title', 'status', 'priority', 'deadline',
            'assigned_to', 'assignee_detail',
            'created_by', 'creator_detail',
            'org_unit', 'tags', 'created_at', 'order',
            'submission', 'subtasks', 'attachments', 'comments' # ДОБАВЛЕНЫ СЮДА
        ]

    def get_submission(self, obj):
        # Безопасное извлечение отчета для каждой задачи
        sub = TaskSubmission.objects.filter(task=obj).first()
        if sub:
            return TaskSubmissionSerializer(sub, context=self.context).data
        return None


class TaskDetailSerializer(serializers.ModelSerializer):
    assignee_detail = UserShortSerializer(source='assigned_to', read_only=True)
    creator_detail = UserShortSerializer(source='created_by', read_only=True)
    subtasks = SubtaskSerializer(many=True, read_only=True)
    attachments = TaskAttachmentSerializer(many=True, read_only=True)
    comments = CommentSerializer(many=True, read_only=True)
    submission = TaskSubmissionSerializer(read_only=True)
    tags = serializers.JSONField(required=False, default=list)

    class Meta:
        model = Task
        fields = [
            'id', 'title', 'description', 'status', 'priority',
            'assigned_to', 'assignee_detail',
            'created_by', 'creator_detail',
            'org_unit', 'deadline', 'tags',
            'subtasks', 'attachments', 'comments', 'submission',
            'created_at', 'updated_at', 'order'
        ]


class TaskCreateSerializer(serializers.ModelSerializer):
    subtasks_data = serializers.ListField(
        child=serializers.DictField(), required=False, write_only=True
    )
    tags = serializers.JSONField(required=False, default=list)

    class Meta:
        model = Task
        fields = [
            'id', 'title', 'description', 'status', 'priority',
            'org_unit', 'assigned_to', 'deadline', 'tags', 'subtasks_data'
        ]

    def create(self, validated_data):
        subtasks_data = validated_data.pop('subtasks_data', [])
        task = Task.objects.create(**validated_data)
        
        for st_data in subtasks_data:
            Task.objects.create(
                parent_task=task,
                created_by=self.context['request'].user if 'request' in self.context else task.created_by,
                title=st_data.get('title', ''),
                status=st_data.get('status', 'planned'),
                priority=task.priority,
                org_unit=task.org_unit,
                assigned_to=task.assigned_to,
            )
        return task

    def update(self, instance, validated_data):
        subtasks_data = validated_data.pop('subtasks_data', None)
        instance = super().update(instance, validated_data)
        
        if subtasks_data is not None:
            instance.subtasks.all().delete()
            for st_data in subtasks_data:
                Task.objects.create(
                    parent_task=instance,
                    created_by=instance.created_by,
                    title=st_data.get('title', ''),
                    status=st_data.get('status', 'planned'),
                    priority=instance.priority,
                    org_unit=instance.org_unit,
                    assigned_to=instance.assigned_to,
                )
        return instance


class TaskMoveSerializer(serializers.Serializer):
    status = serializers.CharField()
    order = serializers.IntegerField(required=False, default=0)


class TaskSubmitSerializer(serializers.Serializer):
    comment = serializers.CharField(required=False, allow_blank=True)


class TaskReviewSerializer(serializers.Serializer):
    comment = serializers.CharField(required=False, allow_blank=True)