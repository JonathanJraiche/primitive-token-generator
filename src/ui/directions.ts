import { converter } from 'culori';
import { DEFAULT_FONT_FAMILY, SCALE_PRESETS } from '../shared/defaults';
import type {
  DirectionId,
  PaletteSlot,
  PrimitiveField,
  ScalePresetId,
  TokenConfig,
} from '../shared/types';
import { densityRuleFor } from './density';

export type PrimitiveChangeInfluence = 'local' | 'palette' | 'system';

type FontTone = 'neutral' | 'technical' | 'friendly' | 'editorial' | 'display';

interface DirectionProfile {
  id: DirectionId;
  name: string;
  fontTone: FontTone;
  seeds: string[];
  harmony: TokenConfig['color']['harmony'];
  neutralStrategy: TokenConfig['color']['neutralStrategy'];
  scalePresetId: ScalePresetId;
  radius: TokenConfig['radius'];
  fonts: TokenConfig['typography']['fontFamily'] & {
    primaryAlternates: string[];
    serifAlternates: string[];
    monoAlternates: string[];
  };
}

export const DIRECTION_PROFILES: DirectionProfile[] = [
  {
    id: 'precise',
    name: 'Precise',
    fontTone: 'technical',
    seeds: ['#2D5BFF', '#2563EB', '#0F75BD'],
    harmony: 'analogous',
    neutralStrategy: 'tinted',
    scalePresetId: 'dense',
    radius: { base: 2, ratio: 2, count: 6 },
    fonts: {
      sans: 'Inter',
      serif: 'Source Serif 4',
      mono: 'IBM Plex Mono',
      primaryAlternates: ['IBM Plex Sans', 'Roboto', 'Helvetica Neue', 'Arial'],
      serifAlternates: ['Source Serif Pro', 'Georgia'],
      monoAlternates: ['Roboto Mono', 'SF Mono', 'Menlo'],
    },
  },
  {
    id: 'quiet',
    name: 'Quiet',
    fontTone: 'neutral',
    seeds: ['#267D83', '#397B8C', '#536F91'],
    harmony: 'analogous',
    neutralStrategy: 'tinted',
    scalePresetId: 'balanced',
    radius: { base: 3, ratio: 2, count: 6 },
    fonts: {
      sans: 'Avenir Next',
      serif: 'Source Serif 4',
      mono: 'Roboto Mono',
      primaryAlternates: ['Source Sans 3', 'Inter', 'Lato', 'Roboto'],
      serifAlternates: ['Literata', 'Georgia'],
      monoAlternates: ['IBM Plex Mono', 'SF Mono', 'Menlo'],
    },
  },
  {
    id: 'friendly',
    name: 'Friendly',
    fontTone: 'friendly',
    seeds: ['#7C3AED', '#D9467C', '#E06A32', '#179B72'],
    harmony: 'triadic',
    neutralStrategy: 'tinted',
    scalePresetId: 'spacious',
    radius: { base: 4, ratio: 2, count: 6 },
    fonts: {
      sans: 'Nunito Sans',
      serif: 'Lora',
      mono: 'Roboto Mono',
      primaryAlternates: ['Nunito', 'Avenir Next', 'Poppins', 'Rubik', 'Inter'],
      serifAlternates: ['Source Serif 4', 'Georgia'],
      monoAlternates: ['IBM Plex Mono', 'SF Mono', 'Menlo'],
    },
  },
  {
    id: 'editorial',
    name: 'Editorial',
    fontTone: 'editorial',
    seeds: ['#A65832', '#9A6A28', '#7A6548'],
    harmony: 'split-complementary',
    neutralStrategy: 'pure',
    scalePresetId: 'editorial',
    radius: { base: 1, ratio: 2, count: 5 },
    fonts: {
      sans: 'Source Sans 3',
      serif: 'Source Serif 4',
      mono: 'IBM Plex Mono',
      primaryAlternates: ['Inter', 'Avenir Next', 'Helvetica Neue', 'Arial'],
      serifAlternates: ['Literata', 'Lora', 'Georgia'],
      monoAlternates: ['Roboto Mono', 'SF Mono', 'Menlo'],
    },
  },
  {
    id: 'bold',
    name: 'Bold',
    fontTone: 'display',
    seeds: ['#DC2626', '#C026D3', '#6D28D9', '#E05A18'],
    harmony: 'complementary',
    neutralStrategy: 'pure',
    scalePresetId: 'compact',
    radius: { base: 2, ratio: 2.5, count: 5 },
    fonts: {
      sans: 'Space Grotesk',
      serif: 'Source Serif 4',
      mono: 'Space Mono',
      primaryAlternates: ['Sora', 'Montserrat', 'Archivo', 'Inter'],
      serifAlternates: ['Georgia', 'Lora'],
      monoAlternates: ['IBM Plex Mono', 'Roboto Mono', 'Menlo'],
    },
  },
  {
    id: 'organic',
    name: 'Organic',
    fontTone: 'editorial',
    seeds: ['#52833D', '#2D8163', '#8A7135'],
    harmony: 'complementary',
    neutralStrategy: 'tinted',
    scalePresetId: 'spacious',
    radius: { base: 6, ratio: 1.75, count: 6 },
    fonts: {
      sans: 'Avenir Next',
      serif: 'Lora',
      mono: 'IBM Plex Mono',
      primaryAlternates: ['Nunito Sans', 'Source Sans 3', 'Inter', 'Lato'],
      serifAlternates: ['Source Serif 4', 'Literata', 'Georgia'],
      monoAlternates: ['Roboto Mono', 'SF Mono', 'Menlo'],
    },
  },
];

const toOklch = converter('oklch');

function circularDistance(first: number, second: number): number {
  const distance = Math.abs(first - second) % 360;
  return Math.min(distance, 360 - distance);
}

function distanceToProfileHue(profile: DirectionProfile, hue: number): number {
  const distances = profile.seeds
    .map((seed) => toOklch(seed)?.h)
    .filter((candidate): candidate is number => candidate !== undefined)
    .map((candidate) => circularDistance(hue, candidate));
  return Math.min(...distances, 180);
}

function classifyFont(family: string): FontTone {
  const name = family.toLowerCase();
  if (/mono|code|console|courier|menlo/.test(name)) return 'technical';
  if (/serif|georgia|times|garamond|baskerville|lora|literata|merriweather|playfair|fraunces|recoleta|canela/.test(name)) return 'editorial';
  if (/rounded|nunito|comfortaa|quicksand|circular|avenir|poppins|rubik|museo/.test(name)) return 'friendly';
  if (/grotesk|display|anton|bebas|impact|montserrat|archivo|sora/.test(name)) return 'display';
  return 'neutral';
}

function chooseAvailable(
  available: string[],
  preferred: string,
  alternates: string[],
  fallback: string,
): string {
  const byLowercase = new Map(available.map((family) => [family.toLowerCase(), family]));
  for (const candidate of [preferred, ...alternates, fallback]) {
    const match = byLowercase.get(candidate.toLowerCase());
    if (match) return match;
  }
  return fallback;
}

export function isPrimitiveLocked(config: TokenConfig, field: PrimitiveField): boolean {
  return Boolean(config.primitiveLocks?.[field]);
}

export function setPrimitiveLock(
  config: TokenConfig,
  field: PrimitiveField,
  locked: boolean,
): TokenConfig {
  const primitiveLocks = { ...config.primitiveLocks };
  if (locked) primitiveLocks[field] = true;
  else delete primitiveLocks[field];
  return { ...config, primitiveLocks };
}

export function isPaletteAnchorLocked(config: TokenConfig, slot: PaletteSlot): boolean {
  return slot === 'primary'
    ? isPrimitiveLocked(config, 'color.seed')
    : Boolean(config.color.locks?.[slot]);
}

export function setPaletteAnchor(
  config: TokenConfig,
  slot: PaletteSlot,
  value: string,
): TokenConfig {
  const normalized = value.toUpperCase();
  if (slot === 'primary') {
    const locks = { ...config.color.locks };
    delete locks.primary;
    return setPrimitiveLock(
      {
        ...config,
        color: {
          ...config.color,
          seed: normalized,
          presetId: undefined,
          locks,
        },
      },
      'color.seed',
      true,
    );
  }
  return {
    ...config,
    color: {
      ...config.color,
      presetId: undefined,
      locks: { ...config.color.locks, [slot]: normalized },
    },
  };
}

export function togglePaletteAnchor(
  config: TokenConfig,
  slot: PaletteSlot,
  value: string,
): TokenConfig {
  if (slot === 'primary') {
    const locks = { ...config.color.locks };
    delete locks.primary;
    return setPrimitiveLock(
      {
        ...config,
        color: { ...config.color, seed: value.toUpperCase(), locks },
      },
      'color.seed',
      !isPrimitiveLocked(config, 'color.seed'),
    );
  }
  const locks = { ...config.color.locks };
  if (locks[slot]) delete locks[slot];
  else locks[slot] = value.toUpperCase();
  return {
    ...config,
    color: { ...config.color, presetId: undefined, locks },
  };
}

export function anchoredCount(config: TokenConfig): number {
  const primitiveCount = Object.keys(config.primitiveLocks ?? {}).length;
  const paletteCount = Object.entries(config.color.locks ?? {}).filter(
    ([slot, value]) => slot !== 'primary' && Boolean(value),
  ).length;
  return primitiveCount + paletteCount;
}

function selectProfile(config: TokenConfig, random: () => number): DirectionProfile {
  const locks = config.primitiveLocks ?? {};
  const hasLocks = Object.keys(locks).length > 0;
  if (!hasLocks) {
    return DIRECTION_PROFILES[Math.floor(random() * DIRECTION_PROFILES.length)] ?? DIRECTION_PROFILES[0];
  }

  const seed = toOklch(config.color.seed);
  const fontTone = classifyFont(config.typography.fontFamily.sans);
  const densityCandidates =
    locks.scalePresetId && config.scalePresetId
      ? DIRECTION_PROFILES.filter((profile) =>
          densityRuleFor(config.scalePresetId).profileIds.includes(profile.id),
        )
      : DIRECTION_PROFILES;
  const candidates = densityCandidates.length > 0 ? densityCandidates : DIRECTION_PROFILES;

  const scored = candidates.map((profile) => {
    let score = random() * 0.01;
    if (locks['color.seed'] && seed?.h !== undefined) {
      score += 4 * (1 - distanceToProfileHue(profile, seed.h) / 180);
    }
    if (locks['color.harmony'] && config.color.harmony === profile.harmony) score += 2;
    if (
      locks['color.neutralStrategy'] &&
      config.color.neutralStrategy === profile.neutralStrategy
    ) score += 1.5;
    if (locks.scalePresetId && config.scalePresetId === profile.scalePresetId) score += 7;
    if (locks['typography.fontFamily.sans']) {
      if (profile.fontTone === fontTone) score += 7;
      if (profile.fonts.sans.toLowerCase() === config.typography.fontFamily.sans.toLowerCase()) score += 2;
    }
    if (locks['spacing.base']) {
      const profilePreset = SCALE_PRESETS.find((item) => item.id === profile.scalePresetId);
      score += Math.max(
        0,
        3 - Math.abs(config.spacing.base - (profilePreset?.spacing.base ?? 4)) / 2,
      );
    }
    if (locks['spacing.ratio']) {
      const profilePreset = SCALE_PRESETS.find((item) => item.id === profile.scalePresetId);
      score += Math.max(
        0,
        2 - Math.abs(config.spacing.ratio - (profilePreset?.spacing.ratio ?? 1.5)) * 4,
      );
    }
    if (locks['typography.baseSize']) {
      const profilePreset = SCALE_PRESETS.find((item) => item.id === profile.scalePresetId);
      score += Math.max(0, 2 - Math.abs(config.typography.baseSize - (profilePreset?.typography.baseSize ?? 16)) / 3);
    }
    if (locks['radius.base']) {
      score += 6 / (1 + Math.abs(config.radius.base - profile.radius.base));
    }
    if (locks['radius.ratio']) {
      score += Math.max(0, 2 - Math.abs(config.radius.ratio - profile.radius.ratio));
    }
    return { profile, score };
  });

  return scored.sort((first, second) => second.score - first.score)[0].profile;
}

function primitiveNumber(config: TokenConfig, field: PrimitiveField): number | undefined {
  switch (field) {
    case 'spacing.base': return config.spacing.base;
    case 'spacing.ratio': return config.spacing.ratio;
    case 'spacing.count': return config.spacing.count;
    case 'typography.baseSize': return config.typography.baseSize;
    case 'typography.ratio': return config.typography.ratio;
    case 'typography.count': return config.typography.count;
    case 'radius.base': return config.radius.base;
    case 'radius.ratio': return config.radius.ratio;
    case 'radius.count': return config.radius.count;
    case 'color.steps': return config.color.steps;
    default: return undefined;
  }
}

function radiusBand(value: number): number {
  if (value <= 4) return 0;
  if (value <= 8) return 1;
  if (value <= 16) return 2;
  return 3;
}

function referenceNumber(config: TokenConfig, field: PrimitiveField): number | undefined {
  const profile = DIRECTION_PROFILES.find((item) => item.id === config.directionId);
  if (field === 'radius.base') return profile?.radius.base;
  if (field === 'radius.ratio') return profile?.radius.ratio;
  const preset = SCALE_PRESETS.find((item) => item.id === config.scalePresetId);
  if (field === 'spacing.base') return preset?.spacing.base;
  if (field === 'spacing.ratio') return preset?.spacing.ratio;
  if (field === 'typography.baseSize') return preset?.typography.baseSize;
  if (field === 'typography.ratio') return preset?.typography.ratio;
  return undefined;
}

/** Returns how far a field edit should propagate through the generated system. */
export function primitiveChangeInfluence(
  field: PrimitiveField,
  before: TokenConfig,
  after: TokenConfig,
): PrimitiveChangeInfluence {
  if (
    field === 'color.seed' ||
    field === 'scalePresetId' ||
    field === 'typography.fontFamily.sans'
  ) return 'system';

  if (field.startsWith('color.')) return 'palette';

  const previous = primitiveNumber(before, field);
  const next = primitiveNumber(after, field);
  const reference = referenceNumber(before, field) ?? previous;
  if (previous === undefined || next === undefined || reference === undefined) return 'local';

  if (field === 'radius.base') {
    const largeDelta = Math.abs(next - previous) >= 8 || Math.abs(next - reference) >= 8;
    const largeBandJump = Math.abs(radiusBand(next) - radiusBand(reference)) >= 2;
    return largeDelta || largeBandJump ? 'system' : 'local';
  }
  if (field === 'radius.ratio') {
    return Math.abs(next - reference) >= 1 ? 'system' : 'local';
  }
  if (field === 'spacing.base') {
    return Math.abs(next - reference) >= 4 && next / Math.max(reference, 1) >= 1.75
      ? 'system'
      : 'local';
  }
  if (field === 'spacing.ratio') {
    return Math.abs(next - reference) >= 0.4 ? 'system' : 'local';
  }
  if (field === 'typography.baseSize') {
    return Math.abs(next - reference) >= 4 ? 'system' : 'local';
  }
  if (field === 'typography.ratio') {
    return Math.abs(next - reference) >= 0.15 ? 'system' : 'local';
  }
  return 'local';
}

export function composeDirection(
  config: TokenConfig,
  fontFamilies: string[],
  random: () => number = Math.random,
): TokenConfig {
  const profile = selectProfile(config, random);
  const locked = (field: PrimitiveField) => isPrimitiveLocked(config, field);
  const intendedPresetId = locked('scalePresetId') && config.scalePresetId
    ? config.scalePresetId
    : profile.scalePresetId;
  const preset = SCALE_PRESETS.find((item) => item.id === intendedPresetId)!;
  const density = densityRuleFor(intendedPresetId);
  const choose = <T>(field: PrimitiveField, current: T, generated: T): T =>
    locked(field) ? current : generated;
  const available = [...new Set([...fontFamilies, ...Object.values(config.typography.fontFamily)])];
  const seed = profile.seeds[Math.floor(random() * profile.seeds.length)] ?? profile.seeds[0];

  const spacing: TokenConfig['spacing'] = {
    base: choose('spacing.base', config.spacing.base, preset.spacing.base),
    ratio: choose('spacing.ratio', config.spacing.ratio, preset.spacing.ratio),
    count: choose('spacing.count', config.spacing.count, preset.spacing.count),
  };
  const typography: TokenConfig['typography'] = {
    ...config.typography,
    ...preset.typography,
    fontFamily: {
      sans: choose(
        'typography.fontFamily.sans',
        config.typography.fontFamily.sans,
        chooseAvailable(
          available,
          profile.fonts.sans,
          profile.fonts.primaryAlternates,
          DEFAULT_FONT_FAMILY.sans,
        ),
      ),
      serif: choose(
        'typography.fontFamily.serif',
        config.typography.fontFamily.serif,
        chooseAvailable(
          available,
          profile.fonts.serif,
          profile.fonts.serifAlternates,
          DEFAULT_FONT_FAMILY.serif,
        ),
      ),
      mono: choose(
        'typography.fontFamily.mono',
        config.typography.fontFamily.mono,
        chooseAvailable(
          available,
          profile.fonts.mono,
          profile.fonts.monoAlternates,
          DEFAULT_FONT_FAMILY.mono,
        ),
      ),
    },
    baseSize: choose('typography.baseSize', config.typography.baseSize, preset.typography.baseSize),
    ratio: choose('typography.ratio', config.typography.ratio, preset.typography.ratio),
    count: choose('typography.count', config.typography.count, preset.typography.count),
  };
  const radius: TokenConfig['radius'] = {
    base: choose('radius.base', config.radius.base, density.radius.base),
    ratio: choose('radius.ratio', config.radius.ratio, density.radius.ratio),
    count: choose('radius.count', config.radius.count, density.radius.count),
  };
  const generatedHarmony = density.harmonies.includes(profile.harmony)
    ? profile.harmony
    : density.harmonies[0];

  return {
    ...config,
    version: '1.3.0',
    directionId: profile.id,
    color: {
      ...config.color,
      seed: choose('color.seed', config.color.seed, seed),
      harmony: choose('color.harmony', config.color.harmony, generatedHarmony),
      neutralStrategy: choose(
        'color.neutralStrategy',
        config.color.neutralStrategy,
        density.neutralStrategy,
      ),
      steps: choose('color.steps', config.color.steps, 11),
      presetId:
        locked('color.seed') &&
        locked('color.harmony') &&
        locked('color.neutralStrategy')
          ? config.color.presetId
          : undefined,
      paletteRevision: (config.color.paletteRevision ?? 0) + 1,
    },
    scalePresetId: intendedPresetId,
    spacing,
    typography,
    radius,
  };
}
