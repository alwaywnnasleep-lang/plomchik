from rest_framework import serializers
from .models import Task, TaskAttachment
from apps.users.serializers import UserShortSerializer


class TaskAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.full_name', read_only=True)
    
    class Meta:
        model = TaskAttachment
        fields = ['id', 'file', 'filename', 'uploaded_by', 'uploaded_by_name', 'created_at']
        read_only_fields = ['uploaded_by', 'created_at']


class SubtaskSerializer(serializers.ModelSerializer):
    assigned_to_detail = UserShortSerializer(source='assigned_to', read_only=True)

    class Meta:
        model = Task
        fields = [
            'id', 'title', 'status', 'priority',
            'assigned_to', 'assigned_to_detail', 'deadline',
        ]


class TaskListSerializer(serializers.ModelSerializer):
    assigned_to_detail = UserShortSerializer(source='assigned_to', read_only=True)
    created_by_detail = UserShortSerializer(source='created_by', read_only=True)
    org_unit_name = serializers.CharField(
        source='org_unit.name', read_only=True, default=None,
    )
    is_overdue = serializers.BooleanField(read_only=True)
    subtask_count = serializers.IntegerField(source='subtasks.count', read_only=True)

    class Meta:
        model = Task
        fields = [
            'id', 'title', 'description', 'status', 'priority',
            'assigned_to', 'assigned_to_detail',
            'created_by', 'created_by_detail',
            'org_unit', 'org_unit_name',
            'parent_task', 'deadline', 'tags', 'order',
            'is_overdue', 'subtask_count',
            'created_at', 'updated_at',
        ]


class TaskDetailSerializer(serializers.ModelSerializer):
    assigned_to_detail = UserShortSerializer(source='assigned_to', read_only=True)
    created_by_detail = UserShortSerializer(source='created_by', read_only=True)
    org_unit_name = serializers.CharField(
        source='org_unit.name', read_only=True, default=None,
    )
    subtasks = SubtaskSerializer(many=True, read_only=True)
    attachments = TaskAttachmentSerializer(many=True, read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = Task
        fields = [
            'id', 'title', 'description', 'status', 'priority',
            'assigned_to', 'assigned_to_detail',
            'created_by', 'created_by_detail',
            'org_unit', 'org_unit_name',
            'parent_task', 'deadline', 'tags', 'order',
            'subtasks', 'attachments',
            'is_overdue',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']


class TaskCreateSerializer(serializers.ModelSerializer):
    subtasks_data = serializers.ListField(
        child=serializers.DictField(), required=False, write_only=True,
    )

    class Meta:
        model = Task
        fields = [
            'title', 'description', 'status', 'priority',
            'assigned_to', 'org_unit', 'parent_task',
            'deadline', 'tags', 'order', 'subtasks_data',
        ]

    def create(self, validated_data):
        subtasks_data = validated_data.pop('subtasks_data', [])
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


class TaskMoveSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Task.Status.choices)
    order = serializers.IntegerField(required=False, default=0)