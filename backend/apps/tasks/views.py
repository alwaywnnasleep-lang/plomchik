from rest_framework import generics, status, filters
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Q
from django_filters.rest_framework import DjangoFilterBackend
from django.shortcuts import get_object_or_404
from django.utils import timezone
from .models import Task, TaskAttachment, TaskComment, CommentAttachment, TaskSubmission, SubmissionAttachment
from .serializers import (
    TaskListSerializer, TaskDetailSerializer,
    TaskCreateSerializer, TaskMoveSerializer,
    TaskAttachmentSerializer, CommentSerializer, CommentCreateSerializer,
    TaskSubmissionSerializer, TaskSubmitSerializer, TaskReviewSerializer,
    CommentAttachmentSerializer
)
from .filters import TaskFilter
from .permissions import (
    CanCreateTask, CanManageTask, CanAssignTo,
    CanCommentOnTask, CanSubmitTask, CanReviewTask
)
from apps.structure.services import get_units_under_authority


class TaskListCreateView(generics.ListCreateAPIView):
    permission_classes = [CanCreateTask, CanAssignTo]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = TaskFilter
    search_fields = ['title', 'description', 'tags']
    ordering_fields = ['deadline', 'priority', 'created_at', 'status', 'order']

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return TaskCreateSerializer
        return TaskListSerializer

    def get_queryset(self):
        user = self.request.user
        unit_ids = get_units_under_authority(user)

        qs = Task.objects.select_related(
            'assigned_to', 'created_by', 'org_unit',
        ).prefetch_related('subtasks', 'attachments', 'comments')  # добавлен prefetch для вложений и комментариев

        if user.role in ('commander', 'deputy_commander'):
            return qs
        return qs.filter(
            Q(assigned_to=user)
            | Q(created_by=user)
            | Q(org_unit_id__in=unit_ids)
        ).distinct()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class TaskDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [CanManageTask, CanAssignTo]
    serializer_class = TaskDetailSerializer

    def get_queryset(self):
        return Task.objects.select_related(
            'assigned_to', 'created_by', 'org_unit'
        ).prefetch_related(
            'subtasks', 'attachments', 'comments', 'submission__files'
        )

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)


class TaskMoveView(APIView):
    def patch(self, request, pk):
        try:
            task = Task.objects.get(pk=pk)
        except Task.DoesNotExist:
            return Response(
                {'error': 'Задача не найдена'},
                status=status.HTTP_404_NOT_FOUND
            )

        self.check_object_permissions(request, task)

        serializer = TaskMoveSerializer(data=request.data)
        if serializer.is_valid():
            task.status = serializer.validated_data['status']
            task.order = serializer.validated_data.get('order', task.order)
            task.save()

            return Response(TaskListSerializer(task).data)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def check_object_permissions(self, request, task):
        user = request.user
        if user.role in ('commander', 'deputy_commander'):
            return
        if task.assigned_to == user or task.created_by == user:
            return
        unit_ids = get_units_under_authority(user)
        if task.org_unit_id and task.org_unit_id in unit_ids:
            return
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied("У вас нет прав на перемещение этой задачи")


class TaskAttachmentUploadView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, pk):
        try:
            task = Task.objects.get(pk=pk)
        except Task.DoesNotExist:
            return Response(
                {'error': 'Задача не найдена'},
                status=status.HTTP_404_NOT_FOUND
            )

        file = request.FILES.get('file')
        if not file:
            return Response(
                {'error': 'Файл не предоставлен'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        attachment = TaskAttachment.objects.create(
            task=task,
            file=file,
            filename=file.name,
            uploaded_by=request.user,
        )
        return Response(
            TaskAttachmentSerializer(attachment).data,
            status=status.HTTP_201_CREATED,
        )

    def get(self, request, pk):
        attachments = TaskAttachment.objects.filter(task_id=pk)
        serializer = TaskAttachmentSerializer(attachments, many=True)
        return Response(serializer.data)


class KanbanBoardView(APIView):
    def get(self, request):
        user = request.user
        unit_ids = get_units_under_authority(user)

        qs = Task.objects.filter(
            parent_task__isnull=True,
        ).select_related(
            'assigned_to', 'created_by', 'org_unit',
        ).prefetch_related('subtasks', 'attachments', 'comments')

        if user.role not in ('commander', 'deputy_commander'):
            qs = qs.filter(
                Q(assigned_to=user)
                | Q(created_by=user)
                | Q(org_unit_id__in=unit_ids)
            ).distinct()

        org_unit = request.query_params.get('org_unit')
        if org_unit:
            qs = qs.filter(org_unit_id=org_unit)

        priority = request.query_params.get('priority')
        if priority:
            qs = qs.filter(priority=priority)

        search = request.query_params.get('search')
        if search:
            qs = qs.filter(title__icontains=search)

        columns = {}
        for status_value, status_label in Task.Status.choices:
            tasks = qs.filter(status=status_value).order_by('order', '-priority')
            columns[status_value] = {
                'label': status_label,
                'tasks': TaskListSerializer(tasks, many=True).data,
                'count': tasks.count(),
            }

        return Response(columns)


class DashboardStatsView(APIView):
    def get(self, request):
        user = request.user
        unit_ids = get_units_under_authority(user)

        if user.role in ('commander', 'deputy_commander'):
            qs = Task.objects.all()
        else:
            qs = Task.objects.filter(
                Q(assigned_to=user)
                | Q(created_by=user)
                | Q(org_unit_id__in=unit_ids)
            ).distinct()

        from datetime import timedelta

        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        total = qs.count()
        in_progress = qs.filter(status='in_progress').count()
        overdue = qs.filter(
            deadline__lt=now,
        ).exclude(status='done').count()
        done_today = qs.filter(
            status='done', updated_at__gte=today_start,
        ).count()

        by_priority = {}
        for p_val, p_label in Task.Priority.choices:
            by_priority[p_val] = qs.filter(priority=p_val).count()

        by_status = {}
        for s_val, s_label in Task.Status.choices:
            by_status[s_val] = qs.filter(status=s_val).count()

        upcoming = qs.filter(
            deadline__gte=now,
            deadline__lte=now + timedelta(days=7),
        ).exclude(status='done').order_by('deadline')[:10]

        from apps.structure.models import OrgUnit
        units_stats = []
        for unit in OrgUnit.objects.filter(parent__isnull=False)[:10]:
            unit_task_count = qs.filter(org_unit=unit).count()
            units_stats.append({
                'unit_id': unit.id,
                'unit_name': unit.name,
                'task_count': unit_task_count,
            })

        return Response({
            'total': total,
            'in_progress': in_progress,
            'overdue': overdue,
            'done_today': done_today,
            'by_priority': by_priority,
            'by_status': by_status,
            'upcoming_deadlines': TaskListSerializer(upcoming, many=True).data,
            'units_activity': units_stats,
        })


# ========== Комментарии ==========
class CommentListCreateView(generics.ListCreateAPIView):
    permission_classes = [CanCommentOnTask]
    serializer_class = CommentSerializer

    def get_queryset(self):
        task_id = self.kwargs['task_pk']
        return TaskComment.objects.filter(task_id=task_id).prefetch_related('attachments')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CommentCreateSerializer
        return CommentSerializer

    def perform_create(self, serializer):
        task = get_object_or_404(Task, pk=self.kwargs['task_pk'])
        serializer.save(task=task, user=self.request.user)


class CommentDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [CanCommentOnTask]
    serializer_class = CommentSerializer

    def get_queryset(self):
        return TaskComment.objects.all().prefetch_related('attachments')


class CommentAttachmentUploadView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, task_pk, comment_pk):
        comment = get_object_or_404(TaskComment, pk=comment_pk, task_id=task_pk)
        file = request.FILES.get('file')
        if not file:
            return Response(
                {'error': 'Файл не предоставлен'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        attachment = CommentAttachment.objects.create(
            comment=comment,
            file=file,
            filename=file.name,
            uploaded_by=request.user,
        )
        return Response(
            CommentAttachmentSerializer(attachment).data,
            status=status.HTTP_201_CREATED,
        )

    def get(self, request, task_pk, comment_pk):
        comment = get_object_or_404(TaskComment, pk=comment_pk, task_id=task_pk)
        attachments = comment.attachments.all()
        serializer = CommentAttachmentSerializer(attachments, many=True)
        return Response(serializer.data)


# ========== Сдача заданий ==========
class TaskSubmitView(APIView):
    permission_classes = [CanSubmitTask]

    def post(self, request, pk):
        task = get_object_or_404(Task, pk=pk)
        serializer = TaskSubmitSerializer(data=request.data)
        if serializer.is_valid():
            submission, created = TaskSubmission.objects.get_or_create(
                task=task,
                defaults={'status': TaskSubmission.Status.PENDING}
            )
            submission.status = TaskSubmission.Status.PENDING
            submission.comment = serializer.validated_data.get('comment', '')
            submission.submitted_at = timezone.now()
            submission.reviewed_by = None
            submission.reviewed_at = None
            submission.review_comment = ''
            submission.save()

            task.status = Task.Status.REVIEW
            task.save()

            return Response(TaskDetailSerializer(task).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class TaskApproveView(APIView):
    permission_classes = [CanReviewTask]

    def post(self, request, pk):
        task = get_object_or_404(Task, pk=pk)
        serializer = TaskReviewSerializer(data=request.data)
        if serializer.is_valid():
            submission = get_object_or_404(TaskSubmission, task=task)
            submission.status = TaskSubmission.Status.APPROVED
            submission.review_comment = serializer.validated_data.get('comment', '')
            submission.reviewed_by = request.user
            submission.reviewed_at = timezone.now()
            submission.save()

            task.status = Task.Status.DONE
            task.save()

            return Response(TaskDetailSerializer(task).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class TaskRejectView(APIView):
    permission_classes = [CanReviewTask]

    def post(self, request, pk):
        task = get_object_or_404(Task, pk=pk)
        serializer = TaskReviewSerializer(data=request.data)
        if serializer.is_valid():
            submission = get_object_or_404(TaskSubmission, task=task)
            submission.status = TaskSubmission.Status.REJECTED
            submission.review_comment = serializer.validated_data.get('comment', '')
            submission.reviewed_by = request.user
            submission.reviewed_at = timezone.now()
            submission.save()

            task.status = Task.Status.IN_PROGRESS
            task.save()

            return Response(TaskDetailSerializer(task).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class SubmissionAttachmentUploadView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, pk):
        task = get_object_or_404(Task, pk=pk)
        submission = get_object_or_404(TaskSubmission, task=task)
        file = request.FILES.get('file')
        if not file:
            return Response(
                {'error': 'Файл не предоставлен'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        attachment = SubmissionAttachment.objects.create(
            submission=submission,
            file=file,
            filename=file.name,
            uploaded_by=request.user,
        )
        return Response(
            SubmissionAttachmentSerializer(attachment).data,
            status=status.HTTP_201_CREATED,
        )