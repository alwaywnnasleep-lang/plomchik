from rest_framework import generics, status, filters
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import action
from django.contrib.auth import get_user_model
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q

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

    # НОВЫЙ МЕТОД: Фильтрация подразделений, доступных для постановки задач
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Если в запросе есть флаг ?available_for_tasks=true
        if self.request.query_params.get('available_for_tasks') == 'true':
            user = self.request.user
            if user.is_superuser:
                return queryset
            
            # Получаем ID подразделений, которыми пользователь может управлять (подчиненные)
            subordinate_ids = get_units_under_authority(user)
            
            # Собираем фильтр: либо это подчиненное подразделение, либо его собственное
            filter_q = Q(id__in=subordinate_ids)
            if user.org_unit_id:
                filter_q |= Q(id=user.org_unit_id)
            
            return queryset.filter(filter_q)
            
        return queryset

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
            target_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'Пользователь не найден'}, status=status.HTTP_404_NOT_FOUND)

        old_unit_name = "—"
        if hasattr(target_user, 'org_unit') and target_user.org_unit:
            old_unit_name = target_user.org_unit.name

        target_unit = None
        if target_unit_id:
            try:
                target_unit = OrgUnit.objects.get(id=target_unit_id)
            except OrgUnit.DoesNotExist:
                return Response({'error': 'Целевое подразделение не найдено'}, status=status.HTTP_404_NOT_FOUND)

        if target_unit:
            target_user.org_unit = target_unit
            target_user.save(update_fields=['org_unit'])

            StructureChange.objects.create(
                org_unit=target_unit,
                org_unit_name=target_unit.name,
                change_type='personnel_moved',
                description=f'{target_user.full_name} перемещен из «{old_unit_name}» в «{target_unit.name}»',
                changed_by=request.user,
            )
        else:
            old_unit_obj = getattr(target_user, 'org_unit', None)
            target_user.org_unit = None
            target_user.save(update_fields=['org_unit'])

            if old_unit_obj:
                StructureChange.objects.create(
                    org_unit=old_unit_obj,
                    org_unit_name=old_unit_obj.name,
                    change_type='personnel_moved',
                    description=f'{target_user.full_name} исключен из подразделения «{old_unit_name}»',
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