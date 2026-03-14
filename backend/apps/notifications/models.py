from django.db import models
from django.conf import settings

class Notification(models.Model):
    TYPE_CHOICES = [
        ('task_assigned', 'Назначена задача'),
        ('deadline_approaching', 'Дедлайн приближается'),
        ('task_completed', 'Задача выполнена'),
        ('structure_changed', 'Структура изменена'),
        ('security_alert', 'Оповещение безопасности'),
    ]
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
        verbose_name='Пользователь'
    )
    notification_type = models.CharField('Тип', max_length=30, choices=TYPE_CHOICES)
    title = models.CharField('Заголовок', max_length=255)
    message = models.TextField('Сообщение')
    is_read = models.BooleanField('Прочитано', default=False)
    related_task = models.ForeignKey(
        'tasks.Task',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        verbose_name='Связанная задача',
        related_name='notifications'
    )
    created_at = models.DateTimeField('Создано', auto_now_add=True)
    
    class Meta:
        verbose_name = 'Уведомление'
        verbose_name_plural = 'Уведомления'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['user', 'is_read']),
            models.Index(fields=['notification_type']),
        ]
    
    def __str__(self):
        return f"{self.get_notification_type_display()}: {self.title}"
    
    def mark_as_read(self):
        self.is_read = True
        self.save(update_fields=['is_read'])