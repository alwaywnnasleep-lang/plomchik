from celery import shared_task
import logging
from .parsers import parse_document

logger = logging.getLogger(__name__)

@shared_task
def parse_uploaded_document(document_id):
    from .models import ParsedDocument
    try:
        doc = ParsedDocument.objects.get(id=document_id)
    except ParsedDocument.DoesNotExist:
        logger.error(f'Document {document_id} not found')
        return

    doc.status = 'parsing'
    doc.save()

    try:
        results = parse_document(doc.file.path, doc.file_type)
        doc.parsed_data = results
        doc.status = 'parsed'
        doc.save()
        logger.info(f'Parsed {doc.filename}: {len(results)} events')
    except Exception as e:
        doc.status = 'error'
        doc.error_message = str(e)
        doc.save()
        logger.error(f'Parse error {doc.filename}: {e}')