from django.contrib import admin
from .models import Task, TaskAttachment


class TaskAttachmentInline(admin.TabularInline):
    model = TaskAttachment
    extra = 0


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = [
        'title', 'status', 'priority', 'assigned_to',
        'org_unit', 'deadline', 'created_at',
    ]
    list_filter = ['status', 'priority', 'org_unit']
    search_fields = ['title', 'description']
    inlines = [TaskAttachmentInline]


@admin.register(TaskAttachment)
class TaskAttachmentAdmin(admin.ModelAdmin):
    list_display = ['filename', 'task', 'uploaded_by', 'created_at']