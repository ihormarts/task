export const palette = {
  white: '#FFFFFF',
  ink: '#14141A',
  inkMuted: '#8E8E99',
  inkSubtle: '#B4B4BE',
  surface: '#F4F4F7',
  surfaceStrong: '#EDEDF2',
  border: '#E7E7ED',
  accent: '#5A5AE6',
  accentSoft: '#EEEDFD',
  accentPressed: '#4747C4',
  danger: '#D64545',
  dangerSoft: '#FDEDED',
  warning: '#B26B00',
  warningSoft: '#FFF4E0',
  success: '#1F9254',
  successSoft: '#E9F7EF',
  scrim: 'rgba(20, 20, 26, 0.45)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const typography = {
  title: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  caption: { fontSize: 11, lineHeight: 15, fontWeight: '400' },
} as const;

export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 } as const;

export const MIN_TOUCH_TARGET = 44;
