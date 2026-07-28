import { clampChroma, converter, formatHex } from 'culori';
import type {
  ContrastResult,
  PaletteSlot,
  PrimitiveToken,
  TokenConfig,
  TokenSet,
} from '../shared/types';

type OklchColor = { mode: 'oklch'; l: number; c: number; h: number; alpha?: number };

const toOklch = converter('oklch');
const toRgb = converter('rgb');
const WHITE = '#ffffff';
const NEAR_BLACK = '#111827';
const STANDARD_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const PALETTE_SLOTS: Array<{ id: PaletteSlot; label: string }> = [
  { id: 'brand', label: 'Brand' },
  { id: 'harmony-1', label: 'Harmony 1' },
  { id: 'harmony-2', label: 'Harmony 2' },
  { id: 'support-1', label: 'Support 1' },
  { id: 'support-2', label: 'Support 2' },
];

function assertConfig(config: TokenConfig): void {
  if (!/^#[0-9a-f]{6}$/i.test(config.color.seed)) throw new Error('Enter a six-digit hex color.');
  if (
    Object.values(config.color.locks ?? {}).some(
      (value) => value !== undefined && !/^#[0-9a-f]{6}$/i.test(value),
    )
  ) {
    throw new Error('Locked palette colors must use six-digit hex values.');
  }
  if (config.color.steps < 5 || config.color.steps > 15) throw new Error('Color steps must be between 5 and 15.');
  if (
    config.spacing.count < 1 ||
    config.typography.count < 1 ||
    config.typography.lineHeight.count < 1 ||
    config.typography.letterSpacing.count < 1 ||
    config.radius.count < 1
  ) {
    throw new Error('Scale counts must be at least 1.');
  }
  if (Object.values(config.typography.fontFamily).some((family) => !family.trim())) {
    throw new Error('Font family values cannot be empty.');
  }
  const { start, end, step } = config.typography.fontWeight;
  if (start < 1 || end > 1000 || end < start || step <= 0) {
    throw new Error('Font weights must use a positive step within 1–1000.');
  }
}

function stepLabels(count: number): number[] {
  if (count <= STANDARD_STEPS.length) return STANDARD_STEPS.slice(0, count);
  const labels = [...STANDARD_STEPS];
  while (labels.length < count) labels.push(labels[labels.length - 1] + 100);
  return labels;
}

function normalizeHue(hue: number): number {
  return ((hue % 360) + 360) % 360;
}

function relativeLuminance(hex: string): number {
  const rgb = toRgb(hex);
  if (!rgb) return 0;
  const channel = (value: number) =>
    value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

export function contrastRatio(a: string, b: string): number {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function inSrgb(color: OklchColor): OklchColor {
  return clampChroma(color, 'oklch', 'rgb') as OklchColor;
}

function resolvedColor(color: OklchColor): { hex: string; oklch: OklchColor } {
  const clamped = inSrgb(color);
  return { hex: formatHex(clamped), oklch: clamped };
}

function enforceContrast(
  candidate: OklchColor,
  background: string,
  minimum: number,
  direction: 'lighter' | 'darker',
): OklchColor {
  let next = { ...candidate };
  let attempts = 0;
  while (contrastRatio(formatHex(inSrgb(next)), background) + 0.001 < minimum && attempts < 80) {
    next.l = Math.max(0.08, Math.min(0.98, next.l + (direction === 'lighter' ? 0.008 : -0.008)));
    attempts += 1;
  }
  return inSrgb(next);
}

function ramp(
  name: string,
  hue: number,
  chroma: number,
  count: number,
  guaranteeTextPairs = true,
  exactMiddle?: OklchColor,
): PrimitiveToken[] {
  const labels = stepLabels(count);
  return labels.map((label, index) => {
    const position = count === 1 ? 0.5 : index / (count - 1);
    const lightness = 0.975 - position * 0.765;
    const chromaCurve = Math.pow(Math.sin(Math.PI * position), 0.72);
    const edgeChroma = chroma * 0.055;
    let color: OklchColor = {
      mode: 'oklch',
      l: lightness,
      c: edgeChroma + chroma * chromaCurve,
      h: normalizeHue(hue),
    };
    if (label === 500 && exactMiddle) color = exactMiddle;

    if (guaranteeTextPairs && label >= 600) color = enforceContrast(color, WHITE, 4.5, 'darker');
    if (guaranteeTextPairs && label <= 300) color = enforceContrast(color, NEAR_BLACK, 4.5, 'lighter');

    const resolved = resolvedColor(color);
    return {
      name: `color/${name}/${label}`,
      type: 'COLOR',
      value: resolved.hex,
      description:
        label >= 600
          ? 'Guaranteed WCAG AA on white for normal text.'
          : label <= 300
            ? 'Guaranteed WCAG AA beneath near-black normal text.'
            : undefined,
      oklch: {
        l: Number(resolved.oklch.l.toFixed(5)),
        c: Number(resolved.oklch.c.toFixed(5)),
        h: Number(normalizeHue(resolved.oklch.h || hue).toFixed(3)),
      },
    };
  });
}

function paletteHueOffsets(harmony: TokenConfig['color']['harmony']): number[] {
  switch (harmony) {
    case 'complementary':
      return [0, 180, 150, 210, 30];
    case 'analogous':
      return [0, -30, 30, -60, 60];
    case 'triadic':
      return [0, 120, 240, 60, 300];
    case 'split-complementary':
      return [0, 150, 210, 30, 330];
  }
}

function seededUnit(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  hash += hash << 13;
  hash ^= hash >>> 7;
  hash += hash << 3;
  hash ^= hash >>> 17;
  hash += hash << 5;
  return (hash >>> 0) / 4294967295;
}

function buildPalette(
  config: TokenConfig,
  seed: OklchColor,
  baseChroma: number,
): Array<{
  id: PaletteSlot;
  label: string;
  hex: string;
  oklch: OklchColor;
}> {
  const offsets = paletteHueOffsets(config.color.harmony);
  return PALETTE_SLOTS.map((slot, index) => {
    const lockedHex = config.color.locks?.[slot.id];
    if (lockedHex) {
      const locked = toOklch(lockedHex);
      if (locked) {
        const resolved = resolvedColor({
          mode: 'oklch',
          l: locked.l,
          c: locked.c,
          h: locked.h ?? seed.h,
        });
        return { ...slot, hex: resolved.hex, oklch: resolved.oklch };
      }
    }

    const revision = Number.isFinite(config.color.paletteRevision)
      ? Math.max(0, Math.floor(config.color.paletteRevision))
      : 0;
    if (slot.id === 'brand' && revision === 0) {
      const anchor = resolvedColor(seed);
      return { ...slot, hex: anchor.hex, oklch: anchor.oklch };
    }
    const variation = revision === 0 ? 0 : 1;
    const key = `${config.color.seed}:${config.color.harmony}:${revision}:${slot.id}`;
    const hueJitter = (seededUnit(`${key}:h`) - 0.5) * 28 * variation;
    const lightnessJitter = (seededUnit(`${key}:l`) - 0.5) * 0.12 * variation;
    const chromaFactor = 1 + (seededUnit(`${key}:c`) - 0.5) * 0.28 * variation;
    const anchor = resolvedColor({
      mode: 'oklch',
      l: Math.max(0.38, Math.min(0.78, seed.l + lightnessJitter)),
      c: Math.max(0.045, baseChroma * chromaFactor),
      h: normalizeHue(seed.h + offsets[index] + hueJitter),
    });
    return { ...slot, hex: anchor.hex, oklch: anchor.oklch };
  });
}

function modularScale(
  category: string,
  base: number,
  ratio: number,
  count: number,
  unit: 'px' | 'rem' = 'px',
): PrimitiveToken[] {
  return Array.from({ length: count }, (_, index) => ({
    name: `${category}/${index}`,
    type: 'FLOAT' as const,
    value: Number((base * Math.pow(ratio, index)).toFixed(4)),
    unit,
  }));
}

function linearScale(
  category: string,
  base: number,
  step: number,
  count: number,
  unit?: 'px' | 'rem',
): PrimitiveToken[] {
  return Array.from({ length: count }, (_, index) => ({
    name: `${category}/${index}`,
    type: 'FLOAT' as const,
    value: Number((base + step * index).toFixed(4)),
    unit,
  }));
}

function fontWeightScale(
  start: number,
  end: number,
  step: number,
): PrimitiveToken[] {
  const tokens: PrimitiveToken[] = [];
  for (let weight = start; weight <= end; weight += step) {
    tokens.push({
      name: `font-weight/${weight}`,
      type: 'FLOAT',
      value: weight,
      dtcgType: 'fontWeight',
    });
  }
  return tokens;
}

function buildContrast(tokens: PrimitiveToken[]): ContrastResult[] {
  return tokens
    .filter((token) => token.type === 'COLOR')
    .flatMap((token) => {
      const foregroundHex = String(token.value);
      const nameParts = token.name.split('/');
      const step = Number(nameParts[nameParts.length - 1]);
      return [
        { background: 'white' as const, backgroundHex: WHITE },
        { background: 'near-black' as const, backgroundHex: NEAR_BLACK },
      ].map(({ background, backgroundHex }) => {
        const ratio = contrastRatio(foregroundHex, backgroundHex);
        const guaranteed = (background === 'white' && step >= 600) || (background === 'near-black' && step <= 300);
        return {
          foreground: token.name,
          background,
          foregroundHex,
          backgroundHex,
          ratio: Number(ratio.toFixed(2)),
          aa: ratio >= 4.5,
          aaa: ratio >= 7,
          largeText: ratio >= 3,
          guaranteed,
        };
      });
    });
}

export function generate(config: TokenConfig): TokenSet {
  assertConfig(config);
  const seed = toOklch(config.color.seed);
  if (!seed || seed.h === undefined) throw new Error('The seed color could not be converted.');

  const baseChroma = Math.max(0.09, Math.min(seed.c || 0.14, 0.23));
  const palette = buildPalette(
    config,
    { mode: 'oklch', l: seed.l, c: seed.c, h: seed.h },
    baseChroma,
  );
  const colorTokens: PrimitiveToken[] = [
    ...palette.flatMap((anchor) =>
      ramp(
        anchor.id,
        anchor.oklch.h,
        anchor.oklch.c,
        config.color.steps,
        true,
        anchor.oklch,
      ),
    ),
    ...ramp(
      'neutral',
      seed.h,
      config.color.neutralStrategy === 'tinted' ? 0.022 : 0,
      config.color.steps,
    ),
    ...ramp('green', 145, 0.16, config.color.steps),
    ...ramp('amber', 80, 0.16, config.color.steps),
    ...ramp('red', 25, 0.18, config.color.steps),
    ...ramp('blue', 255, 0.17, config.color.steps),
  ];

  const spacing = modularScale(
    'space',
    config.spacing.base,
    config.spacing.ratio,
    config.spacing.count,
  );
  const fontPx = modularScale(
    'font-size',
    config.typography.baseSize,
    config.typography.ratio,
    config.typography.count,
  );
  const fontRem: PrimitiveToken[] = fontPx.map((token, index) => ({
    name: `font-size-rem/${index}`,
    type: 'FLOAT',
    value: Number((Number(token.value) / config.typography.remBase).toFixed(4)),
    unit: 'rem',
  }));
  const fontFamily: PrimitiveToken[] = (
    ['sans', 'serif', 'mono'] as const
  ).map((role) => ({
    name: `font-family/${role}`,
    type: 'STRING',
    value: config.typography.fontFamily[role],
    dtcgType: 'fontFamily',
  }));
  const fontWeight = fontWeightScale(
    config.typography.fontWeight.start,
    config.typography.fontWeight.end,
    config.typography.fontWeight.step,
  );
  const lineHeight = linearScale(
    'line-height',
    config.typography.lineHeight.base,
    config.typography.lineHeight.step,
    config.typography.lineHeight.count,
  );
  const letterSpacing = linearScale(
    'letter-spacing',
    config.typography.letterSpacing.base,
    config.typography.letterSpacing.step,
    config.typography.letterSpacing.count,
    config.typography.letterSpacing.unit,
  );
  const radius = modularScale(
    'radius',
    config.radius.base,
    config.radius.ratio,
    config.radius.count,
  );
  radius.push({ name: 'radius/full', type: 'FLOAT', value: 9999, unit: 'px' });

  const tokens = [
    ...colorTokens,
    ...spacing,
    ...fontFamily,
    ...fontPx,
    ...fontRem,
    ...fontWeight,
    ...lineHeight,
    ...letterSpacing,
    ...radius,
  ];
  return {
    configVersion: config.version,
    tokens,
    palette: palette.map(({ id, label, hex }) => ({ id, label, value: hex })),
    contrast: buildContrast(colorTokens),
    guarantees: [
      'Color steps 600 and darker pass WCAG AA (4.5:1) on white.',
      'Color steps 300 and lighter pass WCAG AA (4.5:1) beneath near-black text.',
      'Contrast is guaranteed only for the named pairings, not arbitrary combinations.',
    ],
  };
}

interface DtcgLeaf {
  $type: 'color' | 'dimension' | 'number' | 'string' | 'fontFamily' | 'fontWeight';
  $value: unknown;
  $description?: string;
  $extensions?: Record<string, unknown>;
}

export function toDtcg(tokenSet: TokenSet): Record<string, unknown> {
  const root: Record<string, unknown> = {
    $schema: 'https://www.designtokens.org/schemas/2025.10/format.json',
  };
  for (const token of tokenSet.tokens) {
    const segments = token.name.split('/');
    const leafName = segments.pop()!;
    let cursor = root;
    for (const segment of segments) {
      cursor[segment] ??= {};
      cursor = cursor[segment] as Record<string, unknown>;
    }

    const rgb = token.type === 'COLOR' ? toRgb(String(token.value)) : undefined;
    const leaf: DtcgLeaf =
      token.type === 'COLOR' && rgb
        ? {
            $type: 'color',
            $value: {
              colorSpace: 'srgb',
              components: [
                Number(rgb.r.toFixed(6)),
                Number(rgb.g.toFixed(6)),
                Number(rgb.b.toFixed(6)),
              ],
              alpha: 1,
              hex: token.value,
            },
          }
        : token.dtcgType === 'fontFamily'
          ? { $type: 'fontFamily', $value: token.value }
          : token.dtcgType === 'fontWeight'
            ? { $type: 'fontWeight', $value: token.value }
            : token.unit
              ? { $type: 'dimension', $value: { value: token.value, unit: token.unit } }
              : token.type === 'FLOAT'
                ? { $type: 'number', $value: token.value }
                : { $type: 'string', $value: token.value };
    if (token.description) leaf.$description = token.description;
    cursor[leafName] = leaf;
  }

  root.$extensions = {
    'org.primitive-token-generator': {
      configVersion: tokenSet.configVersion,
      palette: tokenSet.palette,
      contrast: tokenSet.contrast,
      guarantees: tokenSet.guarantees,
    },
  };
  return root;
}
