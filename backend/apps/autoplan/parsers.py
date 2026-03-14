import re
import logging

logger = logging.getLogger('apps')


def parse_docx(file_path):
    from docx import Document

    doc = Document(file_path)
    results = []

    for table in doc.tables:
        headers = []
        for cell in table.rows[0].cells:
            headers.append(cell.text.strip().lower())

        for row in table.rows[1:]:
            row_data = {}
            for idx, cell in enumerate(row.cells):
                key = headers[idx] if idx < len(headers) else f'col_{idx}'
                row_data[key] = cell.text.strip()

            mapped = _map_row(row_data, headers)
            if mapped and mapped.get('title'):
                results.append(mapped)

    return results


def parse_xlsx(file_path):
    from openpyxl import load_workbook

    wb = load_workbook(file_path, read_only=True, data_only=True)
    results = []

    for ws in wb.worksheets:
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            continue

        headers = [str(h).strip().lower() if h else f'col_{i}' for i, h in enumerate(rows[0])]

        for row in rows[1:]:
            row_data = {}
            for idx, val in enumerate(row):
                key = headers[idx] if idx < len(headers) else f'col_{idx}'
                row_data[key] = str(val).strip() if val else ''

            mapped = _map_row(row_data, headers)
            if mapped and mapped.get('title'):
                results.append(mapped)

    wb.close()
    return results


def parse_pdf(file_path):
    from PyPDF2 import PdfReader

    reader = PdfReader(file_path)
    results = []
    full_text = ''

    for page in reader.pages:
        text = page.extract_text()
        if text:
            full_text += text + '\n'

    lines = [l.strip() for l in full_text.split('\n') if l.strip()]

    counter = 1
    for line in lines:
        parts = re.split(r'\t{2,}|\s{3,}', line)
        if len(parts) >= 2:
            results.append({
                'number': str(counter),
                'title': parts[0] if len(parts) > 0 else '',
                'deadline': parts[1] if len(parts) > 1 else '',
                'responsible': parts[2] if len(parts) > 2 else '',
                'note': parts[3] if len(parts) > 3 else '',
            })
            counter += 1

    return results


def parse_document(file_path, file_type):
    parsers = {
        'docx': parse_docx,
        'xlsx': parse_xlsx,
        'xls': parse_xlsx,
        'pdf': parse_pdf,
    }

    parser = parsers.get(file_type)
    if not parser:
        raise ValueError(f'Неподдерживаемый тип файла: {file_type}')

    try:
        return parser(file_path)
    except Exception as e:
        logger.error(f'Ошибка парсинга {file_path}: {e}')
        raise


HEADER_MAPPING = {
    'number': ['№', '№ п/п', 'номер', 'n', '#'],
    'title': ['мероприятие', 'наименование', 'задача', 'название', 'содержание'],
    'deadline': ['срок', 'дата', 'срок выполнения', 'дедлайн', 'до'],
    'responsible': ['ответственный', 'исполнитель', 'отв.', 'кто'],
    'note': ['примечание', 'прим.', 'замечание', 'комментарий'],
}


def _map_row(row_data, headers):
    mapped = {}
    for field, variants in HEADER_MAPPING.items():
        for header_key, value in row_data.items():
            if any(v in header_key for v in variants):
                mapped[field] = value
                break
    if not mapped.get('title'):
        values = list(row_data.values())
        if len(values) >= 2:
            mapped.setdefault('number', values[0])
            mapped.setdefault('title', values[1])
            if len(values) >= 3:
                mapped.setdefault('deadline', values[2])
            if len(values) >= 4:
                mapped.setdefault('responsible', values[3])
            if len(values) >= 5:
                mapped.setdefault('note', values[4])
    return mapped