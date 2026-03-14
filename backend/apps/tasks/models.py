from django.db import models
from django.core.validators import MinValueValidator
from django.conf import settings

class Task(models.Model):
    class Status(models.TextChoices):
        PLANNED = 'planned', 'Запланирована'
        TODO = 'todo', 'К выполнению'
        IN_PROGRESS = 'in_progress', 'В работе'
        REVIEW = 'review', 'На проверке'
        DONE = 'done', 'Выполнена'
    
    class Priority(models.TextChoices):
        CRITICAL = 'critical', 'Критический'
        HIGH = 'high', 'Высокий'
        MEDIUM = 'medium', 'Средний'
        LOW = 'low', 'Низкий'
    
    title = models.CharField('Название', max_length=500)
    description = models.TextField('Описание', blank=True, default='')
    status = models.CharField('Статус', max_length=20, choices=Status.choices, default=Status.PLANNED)
    priority = models.CharField('Приоритет', max_length=10, choices=Priority.choices, default=Priority.MEDIUM)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='Исполнитель',
        related_name='assigned_tasks'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='Создал',
        related_name='created_tasks'
    )
    org_unit = models.ForeignKey(
        'structure.OrgUnit',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='Подразделение',
        related_name='tasks'
    )
    parent_task = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        verbose_name='Родительская задача',
        related_name='subtasks'
    )
    deadline = models.DateTimeField('Срок выполнения', null=True, blank=True)
    tags = models.JSONField('Теги', default=list)
    order = models.IntegerField('Порядок', default=0, validators=[MinValueValidator(0)])
    created_at = models.DateTimeField('Создано', auto_now_add=True)
    updated_at = models.DateTimeField('Обновлено', auto_now=True)
    
    class Meta:
        verbose_name = 'Задача'
        verbose_name_plural = 'Задачи'
        ordering = ['-priority', 'deadline', 'order']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['priority']),
            models.Index(fields=['assigned_to']),
            models.Index(fields=['created_by']),
            models.Index(fields=['org_unit']),
            models.Index(fields=['parent_task']),
            models.Index(fields=['deadline']),
            models.Index(fields=['-created_at']),
        ]
    
    def __str__(self):
        return self.title
    
    @property
    def is_overdue(self):
        from django.utils import timezone
        return self.deadline and self.deadline < timezone.now() and self.status != self.Status.DONE


class TaskAttachment(models.Model):
    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name='attachments',
        verbose_name='Задача'
    )
    file = models.FileField('Файл', upload_to='task_attachments/%Y/%m/%d/')
    filename = models.CharField('Имя файла', max_length=255)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='Загрузил',
        related_name='uploaded_attachments'
    )
    created_at = models.DateTimeField('Загружено', auto_now_add=True)
    
    class Meta:
        verbose_name = 'Вложение задачи'
        verbose_name_plural = 'Вложения задач'
        indexes = [
            models.Index(fields=['task']),
            models.Index(fields=['uploaded_by']),
        ]
    
    def __str__(self):
        return self.filename