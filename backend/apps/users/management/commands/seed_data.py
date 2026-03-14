from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from apps.structure.models import OrgUnit

User = get_user_model()


class Command(BaseCommand):
    help = 'Заполняет БД начальными данными в/ч 2103'

    def handle(self, *args, **options):
        self.stdout.write('Создание структуры в/ч 2103...')

        root = OrgUnit.objects.create(
            name='в/ч 2103', unit_type='military_unit', order=1,
        )
        dept1 = OrgUnit.objects.create(
            name='1-й отдел', unit_type='department', parent=root, order=1,
        )
        dept2 = OrgUnit.objects.create(
            name='2-й отдел', unit_type='department', parent=root, order=2,
        )
        sep_group = OrgUnit.objects.create(
            name='Отдельная группа', unit_type='group', parent=root, order=3,
        )
        grp1 = OrgUnit.objects.create(
            name='1-я группа', unit_type='group', parent=dept1, order=1,
        )
        grp2 = OrgUnit.objects.create(
            name='2-я группа', unit_type='group', parent=dept1, order=2,
        )
        grp3 = OrgUnit.objects.create(
            name='3-я группа', unit_type='group', parent=dept2, order=1,
        )
        grp4 = OrgUnit.objects.create(
            name='4-я группа', unit_type='group', parent=dept2, order=2,
        )

        self.stdout.write('Создание пользователей...')

        commander = User.objects.create_user(
            username='commander', password='Commander2103!',
            last_name='Иванов', first_name='Александр', patronymic='Сергеевич',
            rank='colonel', position='Командир в/ч 2103',
            role='commander', clearance_level=5, org_unit=root,
        )
        root.commander = commander
        root.save()

        deputy = User.objects.create_user(
            username='deputy', password='Deputy2103!!',
            last_name='Петров', first_name='Дмитрий', patronymic='Иванович',
            rank='lt_colonel', position='Заместитель командира в/ч 2103',
            role='deputy_commander', clearance_level=4, org_unit=root,
        )

        head1 = User.objects.create_user(
            username='head_dept1', password='HeadDept12103',
            last_name='Сидоров', first_name='Игорь', patronymic='Петрович',
            rank='major', position='Командир 1-го отдела',
            role='department_head', clearance_level=3, org_unit=dept1,
        )
        dept1.commander = head1
        dept1.save()

        head2 = User.objects.create_user(
            username='head_dept2', password='HeadDept22103',
            last_name='Козлов', first_name='Андрей', patronymic='Николаевич',
            rank='major', position='Командир 2-го отдела',
            role='department_head', clearance_level=3, org_unit=dept2,
        )
        dept2.commander = head2
        dept2.save()

        head_sep = User.objects.create_user(
            username='head_sep', password='HeadSep2103!',
            last_name='Волков', first_name='Сергей', patronymic='Алексеевич',
            rank='captain', position='Командир отдельной группы',
            role='group_head', clearance_level=2, org_unit=sep_group,
        )
        sep_group.commander = head_sep
        sep_group.save()

        groups_data = [
            (grp1, 'head_grp1', 'Морозов', 'Олег', 'Владимирович'),
            (grp2, 'head_grp2', 'Новиков', 'Павел', 'Дмитриевич'),
            (grp3, 'head_grp3', 'Соколов', 'Евгений', 'Игоревич'),
            (grp4, 'head_grp4', 'Лебедев', 'Артём', 'Андреевич'),
        ]
        for grp, uname, ln, fn, pat in groups_data:
            u = User.objects.create_user(
                username=uname, password=f'{uname.capitalize()}2103',
                last_name=ln, first_name=fn, patronymic=pat,
                rank='captain', position=f'Командир {grp.name}',
                role='group_head', clearance_level=2, org_unit=grp,
            )
            grp.commander = u
            grp.save()

        subordinates = [
            (grp1, 'sub1', 'Кузнецов', 'Алексей', 'Сергеевич'),
            (grp1, 'sub2', 'Попов', 'Максим', 'Олегович'),
            (grp2, 'sub3', 'Васильев', 'Роман', 'Павлович'),
            (grp3, 'sub4', 'Зайцев', 'Никита', 'Евгеньевич'),
            (grp4, 'sub5', 'Егоров', 'Денис', 'Артёмович'),
            (sep_group, 'sub6', 'Белов', 'Илья', 'Сергеевич'),
        ]
        for grp, uname, ln, fn, pat in subordinates:
            User.objects.create_user(
                username=uname, password=f'{uname.capitalize()}2103',
                last_name=ln, first_name=fn, patronymic=pat,
                rank='sergeant', position='Специалист',
                role='subordinate', clearance_level=1, org_unit=grp,
            )

        admin_user = User.objects.create_superuser(
            username='admin', password='AdminRubezh2103!',
            last_name='Администратор', first_name='Системный', patronymic='',
            rank='colonel', position='Администратор системы',
            role='commander', clearance_level=5,
        )

        self.stdout.write(self.style.SUCCESS('Данные успешно созданы.'))