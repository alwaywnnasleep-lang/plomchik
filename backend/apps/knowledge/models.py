from django.db import models
from django.conf import settings
import os

class KnowledgeDocument(models.Model):
    CATEGORY_CHOICES = [
        ('instructions', 'Инструкции'),
        ('regulations', 'Регламенты'),
        ('templates', 'Шаблоны'),
        ('other', 'Разное'),
    ]

    title = models.CharField('Название', max_length=255)
    description = models.TextField('Описание', blank=True, default='')
    category = models.CharField('Категория', max_length=50, choices=CATEGORY_CHOICES, default='other')
    file = models.FileField('Файл', upload_to='knowledge_base/%Y/%m/')
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        related_name='knowledge_documents'  # <--- ИСПРАВЛЕНО ЗДЕСЬ
    )
    created_at = models.DateTimeField('Дата загрузки', auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Документ базы знаний'
        verbose_name_plural = 'Документы базы знаний'

    def __str__(self):
        return self.title

    @property
    def file_name(self):
        return os.path.basename(self.file.name) if self.file else ''

    @property
    def file_size(self):
        try:
            return self.file.size
        except:
            return 0