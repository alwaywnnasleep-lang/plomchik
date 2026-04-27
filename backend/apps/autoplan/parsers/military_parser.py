import re
from datetime import datetime, timedelta
from dateutil.parser import parse as date_parse

def normalize_date_str(s: str) -> str:
    """Преобразует '7.10---6.11' или '22--24' в строку диапазона."""
    s = re.sub(r'[—–\-]+', '-', s).strip()
    if '-' in s:
        parts = s.split('-')
        if len(parts) == 2:
            start = parts[0].strip()
            end = parts[1].strip()
            return f"{start}|{end}"
    return s

def parse_single_date(expr: str, base_year: int, base_month: int):
    """Парсит '7.10' или '7' в datetime."""
    if '.' in expr:
        parts = expr.split('.')
        day = int(parts[0])
        month = int(parts[1]) if len(parts) > 1 else base_month
        year = base_year
    else:
        day = int(expr)
        month = base_month
        year = base_year
    try:
        return datetime(year, month, day)
    except ValueError:
        return None

def expand_range(date_expr: str, base_year: int, base_month: int):
    """Возвращает список datetime объектов для диапазона или одиночной даты."""
    if '|' in date_expr:
        start_str, end_str = date_expr.split('|')
        start = parse_single_date(start_str, base_year, base_month)
        end = parse_single_date(end_str, base_year, base_month)
        if start and end:
            delta = (end - start).days
            return [start + timedelta(days=i) for i in range(delta + 1)]
    else:
        d = parse_single_date(date_expr, base_year, base_month)
        return [d] if d else []
    return []

def extract_month_year_from_text(text: str):
    """Ищет 'в октябре 2025 г.' в тексте."""
    match = re.search(r'в\s+(\w+)\s+(\d{4})\s*г\.', text, re.IGNORECASE)
    if match:
        month_name = match.group(1).lower()
        year = int(match.group(2))
        month_map = {
            'января': 1, 'февраля': 2, 'марта': 3, 'апреля': 4,
            'мая': 5, 'июня': 6, 'июля': 7, 'августа': 8,
            'сентября': 9, 'октября': 10, 'ноября': 11, 'декабря': 12
        }
        month = month_map.get(month_name, 10)
        return year, month
    return 2025, 10

def parse_military_table(rows, headers, base_year, base_month):
    """
    Парсит таблицу, где заголовки колонок — числа от 1 до 31.
    Возвращает список событий с полями:
        title, responsible, personnel, date (строка ISO), day, is_range (bool), start, end
    """
    # Определяем колонки-даты
    date_columns = []
    for idx, h in enumerate(headers):
        h_str = str(h).strip()
        if h_str.isdigit() and 1 <= int(h_str) <= 31:
            date_columns.append(idx)

    events = []
    for row_idx, row in enumerate(rows):
        if not any(cell.strip() for cell in row):
            continue
        title = row[0].strip() if len(row) > 0 else ''
        if not title:
            continue
        responsible = row[1].strip() if len(row) > 1 else ''
        personnel = row[2].strip() if len(row) > 2 else ''

        for col_idx in date_columns:
            if col_idx >= len(row):
                continue
            cell = row[col_idx].strip()
            if not cell or cell == '-':
                continue
            norm = normalize_date_str(cell)
            dates = expand_range(norm, base_year, base_month)
            if dates:
                # Если диапазон из нескольких дней — создаём одно событие с start/end
                if len(dates) > 1:
                    events.append({
                        'title': title,
                        'responsible': responsible,
                        'personnel': personnel,
                        'start_date': dates[0].isoformat(),
                        'end_date': dates[-1].isoformat(),
                        'is_range': True,
                    })
                else:
                    events.append({
                        'title': title,
                        'responsible': responsible,
                        'personnel': personnel,
                        'date': dates[0].isoformat(),
                        'is_range': False,
                    })
    # Убираем дубликаты (если одно мероприятие попало на несколько колонок — оставляем одно)
    unique = {}
    for ev in events:
        key = ev['title'] + ev.get('date', '') + ev.get('start_date', '')
        if key not in unique:
            unique[key] = ev
    return list(unique.values())