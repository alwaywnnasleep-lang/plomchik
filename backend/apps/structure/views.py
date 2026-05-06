from rest_framework import generics, status, filters
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import get_user_model
from django_filters.rest_framework import DjangoFilterBackend

from .models import OrgUnit, StructureChange
from .serializers import (
    OrgUnitTreeSerializer, OrgUnitWriteSerializer,
    StructureChangeSerializer, MovePersonnelSerializer,
)
from .permissions import CanManageStructure
from .services import can_manage_unit, get_units_under_authority

User = get_user_model()


class OrgUnitTreeView(generics.ListAPIView):
    serializer_class = OrgUnitTreeSerializer

    def get_queryset(self):
        return OrgUnit.objects.filter(
            parent__isnull=True
        ).prefetch_related(
            'children', 'commander'
        ).select_related('commander')


class OrgUnitListCreateView(generics.ListCreateAPIView):
    queryset = OrgUnit.objects.all().select_related('commander', 'parent')
    permission_classes = [CanManageStructure]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['unit_type', 'parent']
    search_fields = ['name']
    ordering_fields = ['order', 'name', 'created_at']

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return OrgUnitWriteSerializer
        return OrgUnitTreeSerializer

    def perform_create(self, serializer):
        unit = serializer.save()
        StructureChange.objects.create(
            org_unit=unit,
            org_unit_name=unit.name,
            change_type='created',
            description=f'Создано подразделение «{unit.name}»',
            new_data={'name': unit.name, 'type': unit.unit_type},
            changed_by=self.request.user,
        )


class OrgUnitDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = OrgUnit.objects.all().select_related('commander', 'parent')
    permission_classes = [CanManageStructure]

    def get_serializer_class(self):
        if self.request.method in ('PUT', 'PATCH'):
            return OrgUnitWriteSerializer
        return OrgUnitTreeSerializer

    def perform_update(self, serializer):
        old_unit = self.get_object()
        old_name = old_unit.name
        old_commander = old_unit.commander_id
        
        unit = serializer.save()
        
        if old_name != unit.name:
            StructureChange.objects.create(
                org_unit=unit, 
                org_unit_name=unit.name,
                change_type='renamed',
                description=f'Переименование: «{old_name}» → «{unit.name}»',
                old_data={'name': old_name},
                new_data={'name': unit.name},
                changed_by=self.request.user,
            )
        
        if old_commander != unit.commander_id:
            old_commander_name = None
            if old_commander:
                try:
                    old_commander_user = User.objects.get(id=old_commander)
                    old_commander_name = old_commander_user.full_name
                except User.DoesNotExist:
                    old_commander_name = str(old_commander)
            
            new_commander_name = None
            if unit.commander_id:
                new_commander_name = unit.commander.full_name if unit.commander else str(unit.commander_id)
            
            StructureChange.objects.create(
                org_unit=unit,
                org_unit_name=unit.name,
                change_type='commander_changed',
                description=f'Смена командира подразделения «{unit.name}»',
                old_data={'commander_id': old_commander, 'commander_name': old_commander_name},
                new_data={'commander_id': unit.commander_id, 'commander_name': new_commander_name},
                changed_by=self.request.user,
            )

    def perform_destroy(self, instance):
        StructureChange.objects.create(
            org_unit_name=instance.name,
            change_type='deleted',
            description=f'Удалено подразделение «{instance.name}»',
            old_data={'name': instance.name, 'type': instance.unit_type},
            changed_by=self.request.user,
        )
        instance.delete()


class MovePersonnelView(APIView):
    permission_classes = [CanManageStructure]

    def post(self, request):
        serializer = MovePersonnelSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
        user_id = serializer.validated_data['user_id']
        target_unit_id = serializer.validated_data.get('target_unit_id')

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'Не найдено'}, status=status.HTTP_404_NOT_FOUND)

        old_unit_name = "—"
        if hasattr(user, 'org_unit') and user.org_unit:
            old_unit_name = user.org_unit.name
        elif hasattr(user, 'unit') and user.unit:
            old_unit_name = user.unit.name

        target_unit = None
        if target_unit_id:
            try:
                target_unit = OrgUnit.objects.get(id=target_unit_id)
            except OrgUnit.DoesNotExist:
                pass

        if target_unit:
            # ДОБАВЛЕНИЕ ИЛИ ПЕРЕМЕЩЕНИЕ В ПОДРАЗДЕЛЕНИЕ
            if hasattr(target_unit, 'personnel'):
                target_unit.personnel.add(user) 
            elif hasattr(user, 'org_unit'):
                user.org_unit = target_unit
                user.save(update_fields=['org_unit'])
            elif hasattr(user, 'unit'):
                user.unit = target_unit
                user.save(update_fields=['unit'])
            else:
                user.org_unit = target_unit
                user.save()

            StructureChange.objects.create(
                org_unit=target_unit,
                org_unit_name=target_unit.name,
                change_type='personnel_moved',
                description=f'{user.full_name} перемещен из «{old_unit_name}» в «{target_unit.name}»',
                changed_by=request.user,
            )
        else:
            # УДАЛЕНИЕ ИЗ ПОДРАЗДЕЛЕНИЯ
            old_unit_obj = None
            if hasattr(user, 'org_unit'):
                old_unit_obj = user.org_unit
                user.org_unit = None
                user.save(update_fields=['org_unit'])
            elif hasattr(user, 'unit'):
                old_unit_obj = user.unit
                user.unit = None
                user.save(update_fields=['unit'])
            else:
                user.org_unit = None
                user.save()

            if old_unit_obj:
                StructureChange.objects.create(
                    org_unit=old_unit_obj,
                    org_unit_name=old_unit_obj.name,
                    change_type='personnel_moved',
                    description=f'{user.full_name} исключен из подразделения «{old_unit_name}»',
                    changed_by=request.user,
                )

        return Response({'success': True})


class StructureHistoryView(generics.ListAPIView):
    serializer_class = StructureChangeSerializer
    queryset = StructureChange.objects.all().select_related('changed_by')
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['change_type', 'org_unit']
    search_fields = ['description', 'org_unit_name']
    ordering_fields = ['-created_at']