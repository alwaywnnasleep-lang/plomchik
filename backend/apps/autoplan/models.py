from django.db import models
from django.conf import settings

class ParsedDocument(models.Model):
    FILE_TYPE_CHOICES = [
        ('docx', 'Word DOCX'),
        ('doc', 'Word DOC'),
        ('pdf', 'PDF'),
        ('xlsx', 'Excel XLSX'),
        ('xls', 'Excel XLS'),
    ]
    
    STATUS_CHOICES = [
        ('uploaded', 'Загружен'),
        ('parsing', 'Разбор'),
        ('parsed', 'Разобран'),
        ('error', 'Ошибка'),
    ]
    
    file = models.FileField('Файл', upload_to='parsed_documents/%Y/%m/%d/')
    filename = models.CharField('Имя файла', max_length=255)
    file_type = models.CharField('Тип файла', max_length=10, choices=FILE_TYPE_CHOICES)
    status = models.CharField('Статус', max_length=20, choices=STATUS_CHOICES, default='uploaded')
    parsed_data = models.JSONField('Разобранные данные', default=list)
    error_message = models.TextField('Сообщение об ошибке', blank=True, default='')
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='Загрузил',
        related_name='uploaded_documents'
    )
    created_at = models.DateTimeField('Загружено', auto_now_add=True)
    
    class Meta:
        verbose_name = 'Разобранный документ'
        verbose_name_plural = 'Документы автопланирования'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['file_type']),
            models.Index(fields=['-created_at']),
        ]
    
    def __str__(self):
        return f"{self.filename} ({self.get_status_display()})"