/**
 * Tower Control — shared constants and helpers.
 * Walker app components should never import from this file.
 */

/* ── Colors ── */

export const tower = {
  bg: {
    page: '#F4F6F8',
    surface: '#FFFFFF',
    surfaceAlt: '#F0F2F5',
    surfaceHover: '#E8ECF0',
  },
  border: {
    default: '#E2E6EA',
    strong: '#C8CDD4',
    focus: '#534AB7',
  },
  text: {
    primary: '#1A1D23',
    secondary: '#5A6270',
    muted: '#9AA3AE',
    inverse: '#FFFFFF',
  },
  coral:    { base: '#E8634A', dark: '#C94A34', light: '#FAECE7' },
  purple:   { base: '#534AB7', light: '#EEEDFE' },
  sage:     { base: '#2D8F6F', light: '#E8F5EF' },
  amber:    { base: '#C4851C', light: '#FDF3E3' },
  slate:    { base: '#475569', light: '#EEF1F5' },
  fuschia:  { base: '#961e78', light: '#fdf4fb' },
  orange:   { base: '#E8762B', dark: '#C45D1A', light: '#FEF5ED' },
  sector: {
    plateau:     '#3B82A0',
    plateauLight:'#EBF4F8',
    laurier:     '#4A9E6F',
    laurierLight:'#EBF6F0',
  },
  status: {
    red:         '#D94F3D',
    redLight:    '#FEF2F0',
    yellow:      '#E6A817',
    yellowLight: '#FEF9ED',
    green:       '#3D9970',
    greenLight:  '#F0FAF5',
  },
}

/* ── Card style object — spread onto style prop ── */

export const towerCard = {
  background: tower.bg.surface,
  border: `1px solid ${tower.border.default}`,
  borderRadius: 10,
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
}

/* ── Section label style — 11px uppercase bold ── */

export const towerSectionLabel = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: tower.text.muted,
}

/* ── Sector color helper ── */

export function sectorColor(sector) {
  if (sector === 'Plateau') return tower.sector.plateau
  if (sector === 'Laurier') return tower.sector.laurier
  return tower.text.secondary
}

export function sectorBg(sector) {
  if (sector === 'Plateau') return tower.sector.plateauLight
  if (sector === 'Laurier') return tower.sector.laurierLight
  return tower.bg.surfaceAlt
}
