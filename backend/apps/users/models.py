from django.contrib.auth.models import AbstractUser
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator

class User(AbstractUser):
    RANK_CHOICES = [
        ('private', 'Рядовой'),
        ('corporal', 'Ефрейтор'),
        ('sergeant', 'Сержант'),
        ('staff_sergeant', 'Старшина'),
        ('warrant_officer', 'Прапорщик'),
        ('lieutenant', 'Лейтенант'),
        ('sr_lieutenant', 'Старший лейтенант'),
        ('captain', 'Капитан'),
        ('major', 'Майор'),
        ('lt_colonel', 'Подполковник'),
        ('colonel', 'Полковник'),
    ]
    
    ROLE_CHOICES = [
        ('commander', 'Командир'),
        ('deputy_commander', 'Заместитель командира'),
        ('department_head', 'Начальник отдела'),
        ('group_head', 'Начальник группы'),
        ('subordinate', 'Подчиненный'),
    ]
    
    patronymic = models.CharField('Отчество', max_length=150, blank=True, default='')
    rank = models.CharField('Звание', max_length=30, choices=RANK_CHOICES, default='private')
    position = models.CharField('Должность', max_length=255, blank=True, default='')
    role = models.CharField('Роль', max_length=30, choices=ROLE_CHOICES, default='subordinate')
    clearance_level = models.SmallIntegerField(
        'Уровень допуска',
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    org_unit = models.ForeignKey(
        'structure.OrgUnit',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='Подразделение',
        related_name='personnel'
    )
    
    class Meta:
        verbose_name = 'Пользователь'
        verbose_name_plural = 'Пользователи'
        indexes = [
            models.Index(fields=['role']),
            models.Index(fields=['rank']),
            models.Index(fields=['org_unit']),
            models.Index(fields=['clearance_level']),
        ]
    
    def __str__(self):
        return f"{self.last_name} {self.first_name} {self.patronymic}".strip()
    
    @property
    def full_name(self):
        return f"{self.last_name} {self.first_name} {self.patronymic}".strip()