from django.contrib import admin
from .models import Task, TaskAttachment, TaskComment, CommentAttachment, TaskSubmission, SubmissionAttachment


class TaskAttachmentInline(admin.TabularInline):
    model = TaskAttachment
    extra = 0


class TaskCommentInline(admin.TabularInline):
    model = TaskComment
    extra = 0
    readonly_fields = ('user', 'created_at', 'updated_at')


class TaskSubmissionInline(admin.StackedInline):
    model = TaskSubmission
    extra = 0
    readonly_fields = ('submitted_at', 'reviewed_at')


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = [
        'title', 'status', 'priority', 'assigned_to',
        'org_unit', 'deadline', 'created_at',
    ]
    list_filter = ['status', 'priority', 'org_unit']
    search_fields = ['title', 'description']
    inlines = [TaskAttachmentInline, TaskCommentInline, TaskSubmissionInline]


@admin.register(TaskAttachment)
class TaskAttachmentAdmin(admin.ModelAdmin):
    list_display = ['filename', 'task', 'uploaded_by', 'created_at']


@admin.register(TaskComment)
class TaskCommentAdmin(admin.ModelAdmin):
    list_display = ['task', 'user', 'text_preview', 'created_at']
    list_filter = ['created_at']
    search_fields = ['text', 'task__title', 'user__username']

    def text_preview(self, obj):
        return obj.text[:50] + '...' if len(obj.text) > 50 else obj.text
    text_preview.short_description = 'Текст'


@admin.register(CommentAttachment)
class CommentAttachmentAdmin(admin.ModelAdmin):
    list_display = ['filename', 'comment', 'uploaded_by', 'created_at']


@admin.register(TaskSubmission)
class TaskSubmissionAdmin(admin.ModelAdmin):
    list_display = ['task', 'status', 'submitted_at', 'reviewed_by']
    list_filter = ['status', 'submitted_at']
    search_fields = ['task__title', 'comment', 'review_comment']


@admin.register(SubmissionAttachment)
class SubmissionAttachmentAdmin(admin.ModelAdmin):
    list_display = ['filename', 'submission', 'uploaded_by', 'created_at']