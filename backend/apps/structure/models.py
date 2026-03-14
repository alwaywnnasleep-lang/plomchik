from django.db import models
from django.core.validators import MinValueValidator
from django.conf import settings

class OrgUnit(models.Model):
    UNIT_TYPE_CHOICES = [
        ('military_unit', 'Воинская часть'),
        ('department', 'Отдел'),
        ('group', 'Группа'),
    ]
    
    name = models.CharField('Наименование', max_length=255)
    unit_type = models.CharField('Тип', max_length=20, choices=UNIT_TYPE_CHOICES, default='group')
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        verbose_name='Родительское подразделение',
        related_name='children'
    )
    commander = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='Командир',
        related_name='commanded_units'
    )
    order = models.IntegerField('Порядок', default=0, validators=[MinValueValidator(0)])
    created_at = models.DateTimeField('Создано', auto_now_add=True)
    updated_at = models.DateTimeField('Обновлено', auto_now=True)
    
    class Meta:
        verbose_name = 'Подразделение'
        verbose_name_plural = 'Подразделения'
        ordering = ['order', 'name']
        indexes = [
            models.Index(fields=['parent']),
            models.Index(fields=['commander']),
            models.Index(fields=['unit_type']),
        ]
    
    def __str__(self):
        return self.name


class StructureChange(models.Model):
    CHANGE_TYPE_CHOICES = [
        ('created', 'Создано'),
        ('renamed', 'Переименовано'),
        ('moved', 'Перемещено'),
        ('commander_changed', 'Смена командира'),
        ('deleted', 'Удалено'),
        ('personnel_moved', 'Перемещение личного состава'),
        ('type_changed', 'Изменение типа'),
    ]
    
    org_unit_name = models.CharField('Название подразделения', max_length=255)
    org_unit = models.ForeignKey(
        OrgUnit,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='Подразделение',
        related_name='changes'
    )
    change_type = models.CharField('Тип изменения', max_length=30, choices=CHANGE_TYPE_CHOICES)
    description = models.TextField('Описание')
    old_data = models.JSONField('Старые данные', default=dict)
    new_data = models.JSONField('Новые данные', default=dict)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='Изменил',
        related_name='structure_changes'
    )
    created_at = models.DateTimeField('Время', auto_now_add=True)
    
    class Meta:
        verbose_name = 'Изменение структуры'
        verbose_name_plural = 'История изменений структуры'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['org_unit', '-created_at']),
            models.Index(fields=['change_type']),
        ]
    
    def __str__(self):
        return f"{self.org_unit_name} - {self.get_change_type_display()}"