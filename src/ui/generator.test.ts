import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, PRESETS, SCALE_PRESETS } from '../shared/defaults';
import { generate, randomSeedColor, toDtcg } from './generator';

describe('randomSeedColor', () => {
  it('returns a useful six-digit seed and supports deterministic testing', () => {
    const values = [0.25, 0.5, 0.75];
    let index = 0;
    const color = randomSeedColor(() => values[index++] ?? 0.5);

    expect(color).toMatch(/^#[0-9A-F]{6}$/);
    expect(randomSeedColor(() => 0.5)).toBe(randomSeedColor(() => 0.5));
  });
});

describe('generate', () => {
  it('is deterministic for the same recipe', () => {
    expect(generate(DEFAULT_CONFIG)).toEqual(generate(structuredClone(DEFAULT_CONFIG)));
  });

  it.each(PRESETS)('builds a complete in-gamut library for $name', (preset) => {
    const tokenSet = generate({
      ...DEFAULT_CONFIG,
      color: {
        ...DEFAULT_CONFIG.color,
        seed: preset.seed,
        harmony: preset.harmony,
        neutralStrategy: preset.neutralStrategy,
      },
    });
    const colors = tokenSet.tokens.filter((token) => token.type === 'COLOR');
    expect(colors.length).toBeGreaterThanOrEqual(77);
    expect(colors.every((token) => /^#[0-9a-f]{6}$/i.test(String(token.value)))).toBe(true);
  });

  it('enforces every documented AA pairing', () => {
    const guaranteed = generate(DEFAULT_CONFIG).contrast.filter((pair) => pair.guaranteed);
    expect(guaranteed.length).toBeGreaterThan(0);
    expect(guaranteed.every((pair) => pair.aa && pair.ratio >= 4.5)).toBe(true);
  });

  it('keeps the input seed at primary/500', () => {
    const token = generate(DEFAULT_CONFIG).tokens.find((item) => item.name === 'color/primary/500');
    expect(String(token?.value).toLowerCase()).toBe(DEFAULT_CONFIG.color.seed.toLowerCase());
  });

  it('keeps the seed as the primary anchor when the palette is regenerated', () => {
    const token = generate({
      ...DEFAULT_CONFIG,
      color: { ...DEFAULT_CONFIG.color, paletteRevision: 4 },
    }).tokens.find((item) => item.name === 'color/primary/500');
    expect(String(token?.value).toLowerCase()).toBe(DEFAULT_CONFIG.color.seed.toLowerCase());
  });

  it('uses a quieter supporting palette for dense systems than spacious systems', () => {
    const makeConfig = (scalePresetId: 'dense' | 'spacious') => ({
      ...DEFAULT_CONFIG,
      scalePresetId,
      color: {
        ...DEFAULT_CONFIG.color,
        harmony: 'analogous' as const,
        neutralStrategy: 'tinted' as const,
      },
    });
    const dense = generate(makeConfig('dense'));
    const spacious = generate(makeConfig('spacious'));
    const supportingChroma = (tokenSet: typeof dense) =>
      tokenSet.tokens
        .filter((token) => /color\/(harmony|support)-\d\/500/.test(token.name))
        .reduce((sum, token) => sum + (token.oklch?.c ?? 0), 0);

    expect(supportingChroma(dense)).toBeLessThan(supportingChroma(spacious));
    expect(
      dense.tokens.find((token) => token.name === 'color/neutral/500')?.oklch?.c,
    ).toBe(0);
  });

  it('generates five stable palette anchors', () => {
    const palette = generate(DEFAULT_CONFIG).palette;
    expect(palette.map((color) => color.id)).toEqual([
      'primary',
      'harmony-1',
      'harmony-2',
      'support-1',
      'support-2',
    ]);
    expect(palette.every((color) => /^#[0-9a-f]{6}$/i.test(color.value))).toBe(true);
  });

  it('regenerates only unlocked palette anchors deterministically', () => {
    const firstConfig = {
      ...DEFAULT_CONFIG,
      color: {
        ...DEFAULT_CONFIG.color,
        paletteRevision: 1,
        locks: { 'harmony-1': '#DF9A57' },
      },
    };
    const secondConfig = {
      ...firstConfig,
      color: {
        ...firstConfig.color,
        paletteRevision: 2,
      },
    };
    const first = generate(firstConfig);
    const repeated = generate(structuredClone(firstConfig));
    const second = generate(secondConfig);

    expect(first).toEqual(repeated);
    expect(first.palette.find((color) => color.id === 'harmony-1')?.value).toBe('#df9a57');
    expect(second.palette.find((color) => color.id === 'harmony-1')?.value).toBe('#df9a57');
    expect(first.palette.find((color) => color.id === 'harmony-2')?.value).not.toBe(
      second.palette.find((color) => color.id === 'harmony-2')?.value,
    );
  });

  it.each(SCALE_PRESETS)('coordinates spacing and typography for the $name preset', (preset) => {
    const tokenSet = generate({
      ...DEFAULT_CONFIG,
      scalePresetId: preset.id,
      spacing: preset.spacing,
      typography: {
        ...DEFAULT_CONFIG.typography,
        ...preset.typography,
      },
    });
    expect(tokenSet.tokens.find((token) => token.name === 'space/0')?.value).toBe(
      preset.spacing.base,
    );
    expect(tokenSet.tokens.find((token) => token.name === 'font-size/0')?.value).toBe(
      preset.typography.baseSize,
    );
    expect(tokenSet.tokens.filter((token) => token.name.startsWith('space/'))).toHaveLength(9);
    expect(tokenSet.tokens.filter((token) => token.name.startsWith('font-size/'))).toHaveLength(7);
    expect(tokenSet.tokens.filter((token) => token.name.startsWith('font-weight/'))).toHaveLength(9);
    expect(tokenSet.tokens.filter((token) => token.name.startsWith('line-height/'))).toHaveLength(5);
    expect(tokenSet.tokens.filter((token) => token.name.startsWith('letter-spacing/'))).toHaveLength(5);
  });

  it('emits complete typography primitives without changing font-size behavior', () => {
    const tokenSet = generate(DEFAULT_CONFIG);
    const byName = new Map(tokenSet.tokens.map((token) => [token.name, token]));

    expect(byName.get('font-family/sans')?.value).toBe('Inter');
    expect(byName.get('font-family/serif')?.value).toBe('Source Serif 4');
    expect(byName.get('font-family/mono')?.value).toBe('Roboto Mono');
    expect(byName.get('font-size/0')?.value).toBe(16);
    expect(byName.get('font-size-rem/0')?.value).toBe(1);
    expect(byName.get('font-weight/100')?.value).toBe(100);
    expect(byName.get('font-weight/900')?.value).toBe(900);
    expect(byName.get('line-height/0')?.value).toBe(1.2);
    expect(byName.get('line-height/4')?.value).toBe(1.6);
    expect(byName.get('letter-spacing/0')).toMatchObject({
      value: -0.4,
      unit: 'px',
    });
    expect(byName.get('letter-spacing/4')).toMatchObject({
      value: 0.4,
      unit: 'px',
    });
  });

  it('emits DTCG groups with typed color and dimension leaves', () => {
    const output = toDtcg(generate(DEFAULT_CONFIG)) as Record<string, any>;
    expect(output.color.primary['500'].$type).toBe('color');
    expect(output.color.primary['500'].$value).toMatchObject({
      colorSpace: 'srgb',
      alpha: 1,
    });
    expect(output.color.primary['500'].$value.components).toHaveLength(3);
    expect(output.space['0'].$type).toBe('dimension');
    expect(output.space['0'].$value).toEqual({ value: 4, unit: 'px' });
    expect(output['font-family'].sans).toEqual({
      $type: 'fontFamily',
      $value: 'Inter',
    });
    expect(output['font-weight']['400']).toEqual({
      $type: 'fontWeight',
      $value: 400,
    });
    expect(output['line-height']['0']).toEqual({
      $type: 'number',
      $value: 1.2,
    });
    expect(output['letter-spacing']['0']).toEqual({
      $type: 'dimension',
      $value: { value: -0.4, unit: 'px' },
    });
    expect(output.$extensions['org.primitive-token-generator'].palette).toHaveLength(5);
    expect(output.$extensions['org.primitive-token-generator'].contrast.length).toBeGreaterThan(0);
  });
});
