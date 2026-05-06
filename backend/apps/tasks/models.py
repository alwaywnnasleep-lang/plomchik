from django.db import models
from django.core.validators import MinValueValidator
from django.conf import settings
from django.utils.timezone import now
from django.db.models import Q, F

class TaskQuerySet(models.QuerySet):
    def overdue(self):
        """Возвращает задачи, у которых прошел дедлайн и которые не выполнены."""
        return self.filter(deadline__lt=now()).exclude(status=Task.Status.DONE)

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
    # Новые поля для мероприятий и диапазонов
    start_date = models.DateTimeField('Дата начала', null=True, blank=True)
    end_date = models.DateTimeField('Дата окончания', null=True, blank=True)
    is_milestone = models.BooleanField('Мероприятие календаря', default=False)
    tags = models.JSONField('Теги', default=list)
    order = models.IntegerField('Порядок', default=0, validators=[MinValueValidator(0)])
    created_at = models.DateTimeField('Создано', auto_now_add=True)
    updated_at = models.DateTimeField('Обновлено', auto_now=True)

    objects = TaskQuerySet.as_manager()

    def is_overdue(self):
        if self.status == self.Status.DONE:
            return False
        return bool(self.deadline and self.deadline < now())

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
            models.Index(fields=['start_date']),
            models.Index(fields=['end_date']),
        ]
        constraints = [
            models.CheckConstraint(
                check=Q(start_date__isnull=True) | Q(end_date__isnull=True) | Q(start_date__lte=F('end_date')),
                name='check_start_date_before_end_date'
            )
        ]

    def __str__(self):
        return self.title


class AbstractAttachment(models.Model):
    """Абстрактная базовая модель для всех вложений в системе."""
    filename = models.CharField('Имя файла', max_length=255)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='Загрузил'
    )
    created_at = models.DateTimeField('Загружено', auto_now_add=True)

    class Meta:
        abstract = True


class TaskAttachment(AbstractAttachment):
    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name='attachments',
        verbose_name='Задача'
    )
    file = models.FileField('Файл', upload_to='task_attachments/%Y/%m/%d/')

    # Переопределяем related_name для пользователя, чтобы избежать конфликтов
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='Загрузил',
        related_name='uploaded_task_attachments'
    )

    class Meta:
        verbose_name = 'Вложение задачи'
        verbose_name_plural = 'Вложения задач'
        indexes = [
            models.Index(fields=['task']),
            models.Index(fields=['uploaded_by']),
        ]

    def __str__(self):
        return self.filename


class TaskComment(models.Model):
    """Комментарий к задаче."""
    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name='comments',
        verbose_name='Задача'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        verbose_name='Автор',
        related_name='task_comments'
    )
    text = models.TextField('Текст комментария')
    created_at = models.DateTimeField('Создано', auto_now_add=True)
    updated_at = models.DateTimeField('Обновлено', auto_now=True)

    class Meta:
        verbose_name = 'Комментарий'
        verbose_name_plural = 'Комментарии'
        ordering = ['-created_at']

    def __str__(self):
        return f'Комментарий к {self.task} от {self.user}'


class CommentAttachment(AbstractAttachment):
    """Вложение к комментарию."""
    comment = models.ForeignKey(
        TaskComment,
        on_delete=models.CASCADE,
        related_name='attachments',
        verbose_name='Комментарий'
    )
    file = models.FileField('Файл', upload_to='comment_attachments/%Y/%m/%d/')
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='Загрузил',
        related_name='uploaded_comment_attachments'
    )

    class Meta:
        verbose_name = 'Вложение комментария'
        verbose_name_plural = 'Вложения комментариев'

    def __str__(self):
        return self.filename


class TaskSubmission(models.Model):
    """Сдача задания."""
    class Status(models.TextChoices):
        PENDING = 'pending', 'На проверке'
        APPROVED = 'approved', 'Принято'
        REJECTED = 'rejected', 'Отклонено'

    task = models.OneToOneField(
        Task,
        on_delete=models.CASCADE,
        related_name='submission',
        verbose_name='Задача'
    )
    status = models.CharField(
        'Статус',
        max_length=10,
        choices=Status.choices,
        default=Status.PENDING
    )
    comment = models.TextField('Комментарий к сдаче', blank=True, default='')
    submitted_at = models.DateTimeField('Дата сдачи', auto_now_add=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_submissions',
        verbose_name='Проверил'
    )
    reviewed_at = models.DateTimeField('Дата проверки', null=True, blank=True)
    review_comment = models.TextField('Комментарий проверяющего', blank=True, default='')

    class Meta:
        verbose_name = 'Сдача задания'
        verbose_name_plural = 'Сдачи заданий'

    def __str__(self):
        return f'Сдача {self.task}'


class SubmissionAttachment(AbstractAttachment):
    """Вложение к сдаче задания."""
    submission = models.ForeignKey(
        TaskSubmission,
        on_delete=models.CASCADE,
        related_name='files',
        verbose_name='Сдача'
    )
    file = models.FileField('Файл', upload_to='submission_attachments/%Y/%m/%d/')
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='Загрузил',
        related_name='uploaded_submission_attachments'
    )

    class Meta:
        verbose_name = 'Вложение сдачи'
        verbose_name_plural = 'Вложения сдач'

    def __str__(self):
        return self.filename