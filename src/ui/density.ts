import type {
  DirectionId,
  Harmony,
  NeutralStrategy,
  ScalePresetId,
  TokenConfig,
} from '../shared/types';

export interface DensityRule {
  profileIds: DirectionId[];
  harmonies: Harmony[];
  neutralStrategy: NeutralStrategy;
  radius: TokenConfig['radius'];
  palette: {
    chromaScale: number;
    supportChromaScale: number;
    hueSpreadScale: number;
    neutralChroma: number;
  };
}

/**
 * Density primarily changes information load, not hue. These rules keep dense
 * systems quiet and neutral-forward while allowing spacious systems more room
 * for differentiated supporting colors.
 */
export const DENSITY_RULES: Record<ScalePresetId, DensityRule> = {
  dense: {
    profileIds: ['precise'],
    harmonies: ['analogous'],
    neutralStrategy: 'pure',
    radius: { base: 1, ratio: 2, count: 5 },
    palette: {
      chromaScale: 0.72,
      supportChromaScale: 0.76,
      hueSpreadScale: 0.72,
      neutralChroma: 0,
    },
  },
  compact: {
    profileIds: ['bold'],
    harmonies: ['analogous', 'complementary'],
    neutralStrategy: 'tinted',
    radius: { base: 2, ratio: 2, count: 5 },
    palette: {
      chromaScale: 0.84,
      supportChromaScale: 0.86,
      hueSpreadScale: 0.86,
      neutralChroma: 0.012,
    },
  },
  balanced: {
    profileIds: ['quiet'],
    harmonies: ['analogous', 'split-complementary'],
    neutralStrategy: 'tinted',
    radius: { base: 3, ratio: 2, count: 6 },
    palette: {
      chromaScale: 1,
      supportChromaScale: 0.95,
      hueSpreadScale: 1,
      neutralChroma: 0.018,
    },
  },
  spacious: {
    profileIds: ['friendly', 'organic'],
    harmonies: ['triadic', 'complementary', 'split-complementary'],
    neutralStrategy: 'tinted',
    radius: { base: 6, ratio: 2, count: 6 },
    palette: {
      chromaScale: 1.08,
      supportChromaScale: 1.06,
      hueSpreadScale: 1.08,
      neutralChroma: 0.022,
    },
  },
  editorial: {
    profileIds: ['editorial'],
    harmonies: ['split-complementary', 'analogous'],
    neutralStrategy: 'pure',
    radius: { base: 1, ratio: 2, count: 5 },
    palette: {
      chromaScale: 0.78,
      supportChromaScale: 0.82,
      hueSpreadScale: 0.9,
      neutralChroma: 0,
    },
  },
};

export function densityRuleFor(presetId?: ScalePresetId): DensityRule {
  return DENSITY_RULES[presetId ?? 'balanced'];
}
