from rest_framework import serializers
from .models import (
    Task, TaskAttachment, TaskComment, CommentAttachment,
    TaskSubmission, SubmissionAttachment
)
from apps.users.serializers import UserShortSerializer


class TaskAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.full_name', read_only=True)

    class Meta:
        model = TaskAttachment
        fields = ['id', 'file', 'filename', 'uploaded_by', 'uploaded_by_name', 'created_at']
        read_only_fields = ['uploaded_by', 'created_at']


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
        return obj.status == Task.Status.DONE


class CommentAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.full_name', read_only=True)

    class Meta:
        model = CommentAttachment
        fields = ['id', 'file', 'filename', 'uploaded_by', 'uploaded_by_name', 'created_at']
        read_only_fields = ['uploaded_by', 'created_at']


class CommentSerializer(serializers.ModelSerializer):
    user_full_name = serializers.CharField(source='user.full_name', read_only=True)
    user_rank = serializers.CharField(source='user.rank', read_only=True)
    attachments = CommentAttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = TaskComment
        fields = ['id', 'task', 'user', 'user_full_name', 'user_rank', 'text', 'created_at', 'updated_at', 'attachments']
        read_only_fields = ['user', 'created_at', 'updated_at']


class CommentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskComment
        fields = ['text']


class SubmissionAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubmissionAttachment
        fields = ['id', 'file', 'filename', 'created_at']


class TaskSubmissionSerializer(serializers.ModelSerializer):
    files = SubmissionAttachmentSerializer(many=True, read_only=True)
    reviewed_by_detail = UserShortSerializer(source='reviewed_by', read_only=True)

    class Meta:
        model = TaskSubmission
        fields = [
            'id', 'status', 'comment', 'submitted_at',
            'reviewed_by', 'reviewed_by_detail', 'reviewed_at', 'review_comment',
            'files'
        ]
        read_only_fields = ['submitted_at', 'reviewed_at']


class TaskListSerializer(serializers.ModelSerializer):
    assigned_to_detail = UserShortSerializer(source='assigned_to', read_only=True)
    created_by_detail = UserShortSerializer(source='created_by', read_only=True)
    org_unit_name = serializers.CharField(source='org_unit.name', read_only=True, default=None)
    subtask_count = serializers.IntegerField(source='subtasks.count', read_only=True)
    attachments_count = serializers.IntegerField(source='attachments.count', read_only=True)
    comments_count = serializers.IntegerField(source='comments.count', read_only=True)

    # Исправление: is_overdue через метод
    is_overdue = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            'id', 'title', 'description', 'status', 'priority',
            'assigned_to', 'assigned_to_detail',
            'created_by', 'created_by_detail',
            'org_unit', 'org_unit_name',
            'parent_task', 'deadline', 'tags', 'order',
            'is_overdue', 'subtask_count', 'attachments_count', 'comments_count',
            'created_at', 'updated_at',
        ]

    def get_is_overdue(self, obj):
        return obj.is_overdue()


class TaskDetailSerializer(serializers.ModelSerializer):
    assigned_to_detail = UserShortSerializer(source='assigned_to', read_only=True)
    created_by_detail = UserShortSerializer(source='created_by', read_only=True)
    org_unit_name = serializers.CharField(source='org_unit.name', read_only=True, default=None)
    subtasks = serializers.SerializerMethodField()
    submission = TaskSubmissionSerializer(read_only=True)
    attachments = TaskAttachmentSerializer(many=True, read_only=True)
    comments = CommentSerializer(many=True, read_only=True)

    # Исправление: is_overdue через метод
    is_overdue = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            'id', 'title', 'description', 'status', 'priority',
            'assigned_to', 'assigned_to_detail',
            'created_by', 'created_by_detail',
            'org_unit', 'org_unit_name',
            'parent_task', 'deadline', 'tags', 'order',
            'is_overdue', 'subtasks', 'submission', 'attachments', 'comments',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']

    def get_subtasks(self, obj):
        subtasks = obj.subtasks.all()
        return SubtaskSerializer(subtasks, many=True).data

    def get_is_overdue(self, obj):
        return obj.is_overdue()


class TaskCreateSerializer(serializers.ModelSerializer):
    subtasks_data = serializers.ListField(
        child=serializers.DictField(), required=False, write_only=True,
    )
    id = serializers.IntegerField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = Task
        fields = [
            'id', 'created_at', 'title', 'description', 'status', 'priority',
            'assigned_to', 'org_unit', 'parent_task',
            'deadline', 'tags', 'order', 'subtasks_data',
        ]

    def create(self, validated_data):
        subtasks_data = validated_data.pop('subtasks_data', [])
        validated_data.pop('created_by', None)
        task = Task.objects.create(
            created_by=self.context['request'].user,
            **validated_data,
        )
        for st_data in subtasks_data:
            Task.objects.create(
                parent_task=task,
                created_by=self.context['request'].user,
                title=st_data.get('title', ''),
                status=st_data.get('status', Task.Status.PLANNED),
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
                    status=st_data.get('status', Task.Status.PLANNED),
                    priority=instance.priority,
                    org_unit=instance.org_unit,
                    assigned_to=instance.assigned_to,
                )
        return instance


class TaskMoveSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Task.Status.choices)
    order = serializers.IntegerField(required=False, default=0)


class TaskSubmitSerializer(serializers.Serializer):
    comment = serializers.CharField(required=False, allow_blank=True)


class TaskReviewSerializer(serializers.Serializer):
    comment = serializers.CharField(required=False, allow_blank=True)