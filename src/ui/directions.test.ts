import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, SCALE_PRESETS } from '../shared/defaults';
import type { TokenConfig } from '../shared/types';
import {
  anchoredCount,
  composeDirection,
  isPaletteAnchorLocked,
  isPrimitiveLocked,
  primitiveChangeInfluence,
  setPaletteAnchor,
  setPrimitiveLock,
  togglePaletteAnchor,
} from './directions';

const fonts = [
  'Inter',
  'Source Serif 4',
  'Roboto Mono',
  'Nunito Sans',
  'Space Grotesk',
  'Lora',
  'IBM Plex Mono',
];

function fixedRandom(value = 0.2): () => number {
  return () => value;
}

describe('composeDirection', () => {
  it('keeps a chosen primary font and composes the other primitives around it', () => {
    const withFont: TokenConfig = {
      ...DEFAULT_CONFIG,
      typography: {
        ...DEFAULT_CONFIG.typography,
        fontFamily: { ...DEFAULT_CONFIG.typography.fontFamily, sans: 'Nunito Sans' },
      },
    };
    const anchored = setPrimitiveLock(withFont, 'typography.fontFamily.sans', true);
    const result = composeDirection(anchored, fonts, fixedRandom());

    expect(result.typography.fontFamily.sans).toBe('Nunito Sans');
    expect(result.directionId).toBe('friendly');
    expect(result.scalePresetId).toBe('spacious');
    expect(result.radius.base).toBe(6);
  });

  it('treats a density preset as an anchor for the whole direction', () => {
    const dense = SCALE_PRESETS.find((preset) => preset.id === 'dense')!;
    const configured: TokenConfig = {
      ...DEFAULT_CONFIG,
      scalePresetId: dense.id,
      spacing: { ...dense.spacing },
      typography: {
        ...DEFAULT_CONFIG.typography,
        ...dense.typography,
      },
    };
    const anchored = setPrimitiveLock(configured, 'scalePresetId', true);
    const result = composeDirection(anchored, fonts, fixedRandom());

    expect(result.scalePresetId).toBe('dense');
    expect(result.spacing).toEqual(dense.spacing);
    expect(result.directionId).toBe('precise');
    expect(result.radius.base).toBe(1);
    expect(result.color.harmony).toBe('analogous');
    expect(result.color.neutralStrategy).toBe('pure');
  });

  it('never changes a locked corner-radius field', () => {
    const configured: TokenConfig = {
      ...DEFAULT_CONFIG,
      radius: { ...DEFAULT_CONFIG.radius, base: 12 },
    };
    const anchored = setPrimitiveLock(configured, 'radius.base', true);
    const result = composeDirection(anchored, fonts, fixedRandom(0.8));

    expect(result.radius.base).toBe(12);
    expect(result.directionId).toBe('organic');
  });

  it('keeps locked density authoritative when another major anchor conflicts', () => {
    const dense = SCALE_PRESETS.find((preset) => preset.id === 'dense')!;
    const configured: TokenConfig = {
      ...DEFAULT_CONFIG,
      scalePresetId: dense.id,
      spacing: { ...dense.spacing },
      typography: {
        ...DEFAULT_CONFIG.typography,
        ...dense.typography,
        fontFamily: {
          ...DEFAULT_CONFIG.typography.fontFamily,
          sans: 'Nunito Sans',
        },
      },
    };
    const withDensity = setPrimitiveLock(configured, 'scalePresetId', true);
    const anchored = setPrimitiveLock(withDensity, 'typography.fontFamily.sans', true);
    const result = composeDirection(anchored, fonts, fixedRandom());

    expect(result.scalePresetId).toBe('dense');
    expect(result.spacing).toEqual(dense.spacing);
    expect(result.typography.fontFamily.sans).toBe('Nunito Sans');
    expect(result.directionId).toBe('precise');
    expect(result.radius.base).toBe(1);
    expect(result.color.harmony).toBe('analogous');
  });
});

describe('primitiveChangeInfluence', () => {
  const withRadius = (base: number): TokenConfig => ({
    ...DEFAULT_CONFIG,
    directionId: 'quiet',
    radius: { ...DEFAULT_CONFIG.radius, base },
  });

  it('keeps small radius edits local', () => {
    expect(
      primitiveChangeInfluence('radius.base', withRadius(5), withRadius(7)),
    ).toBe('local');
  });

  it('recomposes for a large radius change', () => {
    expect(
      primitiveChangeInfluence('radius.base', withRadius(5), withRadius(24)),
    ).toBe('system');
  });

  it('limits supporting font and palette edits to their relevant scope', () => {
    expect(
      primitiveChangeInfluence(
        'typography.fontFamily.serif',
        DEFAULT_CONFIG,
        DEFAULT_CONFIG,
      ),
    ).toBe('local');
    expect(
      primitiveChangeInfluence('color.harmony', DEFAULT_CONFIG, DEFAULT_CONFIG),
    ).toBe('palette');
  });
});

describe('palette anchors', () => {
  it('uses the same anchor for Primary in the editor and the primary color field', () => {
    const anchored = setPaletteAnchor(DEFAULT_CONFIG, 'primary', '#7A6548');

    expect(anchored.color.seed).toBe('#7A6548');
    expect(anchored.color.locks.primary).toBeUndefined();
    expect(isPrimitiveLocked(anchored, 'color.seed')).toBe(true);
    expect(isPaletteAnchorLocked(anchored, 'primary')).toBe(true);
    expect(anchoredCount(anchored)).toBe(1);

    const unlocked = togglePaletteAnchor(anchored, 'primary', '#7A6548');
    expect(isPrimitiveLocked(unlocked, 'color.seed')).toBe(false);
    expect(isPaletteAnchorLocked(unlocked, 'primary')).toBe(false);
    expect(anchoredCount(unlocked)).toBe(0);
  });

  it('counts supporting palette locks and primitive anchors together', () => {
    const withPrimitive = setPrimitiveLock(DEFAULT_CONFIG, 'radius.base', true);
    const withPalette = setPaletteAnchor(withPrimitive, 'support-1', '#179B72');

    expect(anchoredCount(withPalette)).toBe(2);
    expect(anchoredCount(togglePaletteAnchor(withPalette, 'support-1', '#179B72'))).toBe(1);
  });
});
