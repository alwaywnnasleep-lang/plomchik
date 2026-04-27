const RANK_TRANSLATIONS: Record<string, string> = {
  'private': 'рядовой',
  'corporal': 'ефрейтор',
  'sergeant': 'сержант',
  'staff_sergeant': 'старшина',
  'warrant_officer': 'прапорщик',
  'lieutenant': 'лейтенант',
  'sr_lieutenant': 'ст. лейтенант',
  'captain': 'капитан',
  'major': 'майор',
  'lt_colonel': 'подполковник',
  'colonel': 'полковник',
};

const RANK_ABBREVIATIONS: Record<string, string> = {
  'private': 'ряд.',
  'corporal': 'ефр.',
  'sergeant': 'с-т',
  'staff_sergeant': 'ст-на',
  'warrant_officer': 'пр-к',
  'lieutenant': 'л-т',
  'sr_lieutenant': 'ст. л-т',
  'captain': 'к-н',
  'major': 'м-р',
  'lt_colonel': 'п/п-к',
  'colonel': 'п-к',
};

export function translateRank(rank: string): string {
  if (!rank) return '';
  const full = RANK_TRANSLATIONS[rank] || rank;
  const abbrev = RANK_ABBREVIATIONS[rank] || rank;
  return `${full} (${abbrev})`;
}