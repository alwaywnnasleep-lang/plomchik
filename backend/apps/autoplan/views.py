from rest_framework import generics, status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.views import APIView

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

        created_tasks = []
        for idx in indices:
            if idx >= len(doc.parsed_data):
                continue
            item = doc.parsed_data[idx]

            deadline = None
            deadline_str = item.get('deadline', '')
            if deadline_str:
                from django.utils.dateparse import parse_datetime, parse_date
                deadline = parse_datetime(deadline_str)
                if not deadline:
                    d = parse_date(deadline_str)
                    if d:
                        from django.utils import timezone
                        from datetime import time
                        deadline = timezone.make_aware(
                            timezone.datetime.combine(d, time(18, 0)),
                        )

            task = Task.objects.create(
                title=item.get('title', f'Мероприятие {idx + 1}'),
                description=item.get('note', ''),
                status='planned',
                priority=priority,
                created_by=request.user,
                org_unit_id=org_unit_id,
                deadline=deadline,
                tags=['автоплан', doc.filename],
            )
            created_tasks.append({
                'id': task.id,
                'title': task.title,
                'deadline': str(task.deadline) if task.deadline else None,
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