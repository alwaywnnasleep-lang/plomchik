from rest_framework import generics, status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.views import APIView
from datetime import datetime

from .models import ParsedDocument
from .serializers import (
    ParsedDocumentSerializer,
    DocumentUploadSerializer,
    GenerateTasksSerializer,
)
from .celery_tasks import parse_uploaded_document
from apps.tasks.models import Task
from apps.users.permissions import IsHeadOrAbove


class DocumentUploadView(APIView):
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsHeadOrAbove]

    def post(self, request):
        serializer = DocumentUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        file = serializer.validated_data['file']
        ext = file.name.rsplit('.', 1)[-1].lower()

        doc = ParsedDocument.objects.create(
            file=file,
            filename=file.name,
            file_type=ext,
            uploaded_by=request.user,
        )

        parse_uploaded_document.delay(doc.id)

        return Response(
            ParsedDocumentSerializer(doc).data,
            status=status.HTTP_201_CREATED,
        )


class DocumentDetailView(generics.RetrieveDestroyAPIView):
    serializer_class = ParsedDocumentSerializer
    queryset = ParsedDocument.objects.all()
    permission_classes = [IsHeadOrAbove]


class DocumentListView(generics.ListAPIView):
    serializer_class = ParsedDocumentSerializer
    permission_classes = [IsHeadOrAbove]

    def get_queryset(self):
        return ParsedDocument.objects.filter(
            uploaded_by=self.request.user,
        )


class GenerateTasksView(APIView):
    permission_classes = [IsHeadOrAbove]

    def post(self, request, pk):
        try:
            doc = ParsedDocument.objects.get(pk=pk)
        except ParsedDocument.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        if doc.status != 'parsed':
            return Response(
                {'detail': 'Документ ещё не обработан.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = GenerateTasksSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        indices = serializer.validated_data['selected_indices']
        priority = serializer.validated_data['priority']
        org_unit_id = serializer.validated_data.get('org_unit_id')
        custom_events = serializer.validated_data.get('custom_events', [])

        # Если подразделение не указано, берём подразделение текущего пользователя
        if not org_unit_id and request.user.org_unit:
            org_unit_id = request.user.org_unit.id

        created_tasks = []
        for idx in indices:
            if idx >= len(doc.parsed_data):
                continue
            item = doc.parsed_data[idx]

            # Переопределяем значения из custom_events
            custom = next((ce for ce in custom_events if ce.get('originalIndex') == idx or ce.get('index') == idx), None)
            title = custom.get('title') if custom else item.get('title', f'Мероприятие {idx+1}')
            deadline_str = custom.get('date') if custom else item.get('date') or item.get('deadline')
            responsible = custom.get('responsible') if custom else item.get('responsible', '')

            deadline = None
            start_date = None
            end_date = None

            # Парсим дату
            if deadline_str:
                from django.utils.dateparse import parse_datetime, parse_date
                deadline = parse_datetime(deadline_str) or parse_date(deadline_str)
                if deadline and not isinstance(deadline, datetime):
                    deadline = datetime.combine(deadline, datetime.min.time())
                start_date = deadline
                end_date = deadline

            # Создаём задачу со статусом 'planned' и is_milestone=True для календаря
            task = Task.objects.create(
                title=title,
                description=item.get('description', '') or f"Ответственный: {responsible}",
                status=Task.Status.PLANNED,
                priority=priority,
                created_by=request.user,
                org_unit_id=org_unit_id,
                deadline=deadline,
                start_date=start_date,
                end_date=end_date,
                is_milestone=True,
                tags=['автоплан', doc.filename],
            )
            created_tasks.append({
                'id': task.id,
                'title': task.title,
                'deadline': deadline.isoformat() if deadline else None,
            })

        return Response({
            'created_count': len(created_tasks),
            'tasks': created_tasks,
        }, status=status.HTTP_201_CREATED)


class ParseSyncView(APIView):
    permission_classes = [IsHeadOrAbove]

    def post(self, request, pk):
        try:
            doc = ParsedDocument.objects.get(pk=pk)
        except ParsedDocument.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        from .parsers import parse_document

        doc.status = 'parsing'
        doc.save()

        try:
            results = parse_document(doc.file.path, doc.file_type)
            doc.parsed_data = results
            doc.status = 'parsed'
            doc.save()
            return Response(ParsedDocumentSerializer(doc).data)
        except Exception as e:
            doc.status = 'error'
            doc.error_message = str(e)
            doc.save()
            return Response(
                {'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )