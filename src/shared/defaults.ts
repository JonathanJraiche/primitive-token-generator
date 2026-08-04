import type { ColorPreset, ScalePreset, TokenConfig } from './types';

export const PRESETS: ColorPreset[] = [
  { id: 'cobalt', name: 'Cobalt', seed: '#2D5BFF', harmony: 'analogous', neutralStrategy: 'tinted' },
  { id: 'violet', name: 'Violet', seed: '#7C3AED', harmony: 'analogous', neutralStrategy: 'tinted' },
  { id: 'emerald', name: 'Emerald', seed: '#059669', harmony: 'complementary', neutralStrategy: 'tinted' },
  { id: 'crimson', name: 'Crimson', seed: '#DC2626', harmony: 'split-complementary', neutralStrategy: 'pure' },
  { id: 'amber', name: 'Amber', seed: '#D97706', harmony: 'triadic', neutralStrategy: 'tinted' },
  { id: 'teal', name: 'Teal', seed: '#0D9488', harmony: 'complementary', neutralStrategy: 'tinted' },
];

export const DEFAULT_FONT_FAMILY: TokenConfig['typography']['fontFamily'] = {
  sans: 'Inter',
  serif: 'Source Serif 4',
  mono: 'Roboto Mono',
};

const FULL_FONT_WEIGHT: TokenConfig['typography']['fontWeight'] = {
  start: 100,
  end: 900,
  step: 100,
};

export const SCALE_PRESETS: ScalePreset[] = [
  {
    id: 'dense',
    name: 'Dense',
    useCase: 'data-heavy UI',
    spacing: { base: 2, ratio: 1.5, count: 9 },
    typography: {
      baseSize: 13,
      ratio: 1.2,
      count: 7,
      remBase: 16,
      lineHeight: { base: 1.15, step: 0.1, count: 5 },
      fontWeight: { ...FULL_FONT_WEIGHT },
      letterSpacing: { base: -0.2, step: 0.1, count: 5, unit: 'px' },
    },
  },
  {
    id: 'compact',
    name: 'Compact',
    useCase: 'productivity UI',
    spacing: { base: 4, ratio: 1.333, count: 9 },
    typography: {
      baseSize: 14,
      ratio: 1.2,
      count: 7,
      remBase: 16,
      lineHeight: { base: 1.2, step: 0.1, count: 5 },
      fontWeight: { ...FULL_FONT_WEIGHT },
      letterSpacing: { base: -0.25, step: 0.125, count: 5, unit: 'px' },
    },
  },
  {
    id: 'balanced',
    name: 'Balanced',
    useCase: 'general UI',
    spacing: { base: 4, ratio: 1.5, count: 9 },
    typography: {
      baseSize: 16,
      ratio: 1.25,
      count: 7,
      remBase: 16,
      lineHeight: { base: 1.2, step: 0.1, count: 5 },
      fontWeight: { ...FULL_FONT_WEIGHT },
      letterSpacing: { base: -0.4, step: 0.2, count: 5, unit: 'px' },
    },
  },
  {
    id: 'spacious',
    name: 'Spacious',
    useCase: 'touch-first UI',
    spacing: { base: 8, ratio: 1.5, count: 9 },
    typography: {
      baseSize: 17,
      ratio: 1.25,
      count: 7,
      remBase: 16,
      lineHeight: { base: 1.25, step: 0.1, count: 5 },
      fontWeight: { ...FULL_FONT_WEIGHT },
      letterSpacing: { base: -0.4, step: 0.2, count: 5, unit: 'px' },
    },
  },
  {
    id: 'editorial',
    name: 'Editorial',
    useCase: 'long-form content',
    spacing: { base: 8, ratio: 1.333, count: 9 },
    typography: {
      baseSize: 18,
      ratio: 1.333,
      count: 7,
      remBase: 16,
      lineHeight: { base: 1.25, step: 0.125, count: 5 },
      fontWeight: { ...FULL_FONT_WEIGHT },
      letterSpacing: { base: -0.6, step: 0.3, count: 5, unit: 'px' },
    },
  },
];

const DEFAULT_SCALE_PRESET = SCALE_PRESETS.find((preset) => preset.id === 'balanced')!;

export const DEFAULT_CONFIG: TokenConfig = {
  version: '1.3.0',
  primitiveLocks: {},
  color: {
    seed: PRESETS[0].seed,
    harmony: PRESETS[0].harmony,
    neutralStrategy: PRESETS[0].neutralStrategy,
    steps: 11,
    presetId: PRESETS[0].id,
    paletteRevision: 0,
    locks: {},
  },
  scalePresetId: DEFAULT_SCALE_PRESET.id,
  spacing: { ...DEFAULT_SCALE_PRESET.spacing },
  typography: {
    ...DEFAULT_SCALE_PRESET.typography,
    fontFamily: { ...DEFAULT_FONT_FAMILY },
  },
  radius: { base: 2, ratio: 2, count: 6 },
  accessibility: { standard: 'AA' },
  overrides: {},
};
