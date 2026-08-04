import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DEFAULT_CONFIG, PRESETS, SCALE_PRESETS } from '../shared/defaults';
import type {
  MainToUiMessage,
  PaletteSlot,
  PrimitiveField,
  RemovalCandidate,
  TokenConfig,
  TokenSet,
  UiToMainMessage,
  WriteSummary,
} from '../shared/types';
import { generate, randomSeedColor, toDtcg } from './generator';
import {
  anchoredCount,
  composeDirection,
  DIRECTION_PROFILES,
  isPaletteAnchorLocked,
  isPrimitiveLocked,
  primitiveChangeInfluence,
  setPaletteAnchor,
  setPrimitiveLock,
  togglePaletteAnchor,
} from './directions';
import './styles.css';

const post = (message: UiToMainMessage) => parent.postMessage({ pluginMessage: message }, '*');

function Icon({
  name,
  size = 16,
}: {
  name: 'download' | 'upload' | 'spark' | 'check' | 'alert' | 'lock' | 'unlock' | 'grid';
  size?: number;
}) {
  const paths = {
    download: <><path d="M12 3v12m0 0 4-4m-4 4-4-4" /><path d="M5 19h14" /></>,
    upload: <><path d="M12 16V4m0 0-4 4m4-4 4 4" /><path d="M5 20h14" /></>,
    spark: <><path d="m12 3 1.3 4.2L17.5 8.5l-4.2 1.3L12 14l-1.3-4.2-4.2-1.3 4.2-1.3L12 3Z" /><path d="m18.5 14 .7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3Z" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    alert: <><path d="M12 4 3.5 19h17L12 4Z" /><path d="M12 9v4m0 3h.01" /></>,
    lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    unlock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 7.5-2" /></>,
    grid: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

function normalizeImportedConfig(value: unknown): TokenConfig {
  if (!value || typeof value !== 'object') throw new Error('This file does not contain a token recipe.');
  const candidate = value as Partial<TokenConfig>;
  if (!candidate.color || !candidate.spacing || !candidate.typography || !candidate.radius) {
    throw new Error('The recipe is missing required color or scale settings.');
  }
  const spacing = { ...DEFAULT_CONFIG.spacing, ...candidate.spacing };
  const importedColor = candidate.color as Partial<TokenConfig['color']>;
  const importedLocks = {
    ...DEFAULT_CONFIG.color.locks,
    ...importedColor.locks,
  } as Record<string, string | undefined>;
  const legacyPrimaryOverride = importedLocks.primary ?? importedLocks.brand;
  delete importedLocks.primary;
  delete importedLocks.brand;
  const color: TokenConfig['color'] = {
    ...DEFAULT_CONFIG.color,
    ...importedColor,
    seed: legacyPrimaryOverride ?? importedColor.seed ?? DEFAULT_CONFIG.color.seed,
    locks: importedLocks,
  };
  const primitiveLocks = { ...candidate.primitiveLocks };
  if (legacyPrimaryOverride) primitiveLocks['color.seed'] = true;
  const importedTypography =
    candidate.typography as Partial<TokenConfig['typography']>;
  const typography: TokenConfig['typography'] = {
    ...DEFAULT_CONFIG.typography,
    ...importedTypography,
    fontFamily: {
      ...DEFAULT_CONFIG.typography.fontFamily,
      ...importedTypography.fontFamily,
    },
    lineHeight: {
      ...DEFAULT_CONFIG.typography.lineHeight,
      ...importedTypography.lineHeight,
    },
    fontWeight: {
      ...DEFAULT_CONFIG.typography.fontWeight,
      ...importedTypography.fontWeight,
    },
    letterSpacing: {
      ...DEFAULT_CONFIG.typography.letterSpacing,
      ...importedTypography.letterSpacing,
    },
  };
  const matchingScalePreset = SCALE_PRESETS.find(
    (preset) =>
      preset.spacing.base === spacing.base &&
      preset.spacing.ratio === spacing.ratio &&
      preset.spacing.count === spacing.count &&
      preset.typography.baseSize === typography.baseSize &&
      preset.typography.ratio === typography.ratio &&
      preset.typography.count === typography.count &&
      preset.typography.remBase === typography.remBase &&
      preset.typography.lineHeight.base === typography.lineHeight.base &&
      preset.typography.lineHeight.step === typography.lineHeight.step &&
      preset.typography.lineHeight.count === typography.lineHeight.count &&
      preset.typography.fontWeight.start === typography.fontWeight.start &&
      preset.typography.fontWeight.end === typography.fontWeight.end &&
      preset.typography.fontWeight.step === typography.fontWeight.step &&
      preset.typography.letterSpacing.base === typography.letterSpacing.base &&
      preset.typography.letterSpacing.step === typography.letterSpacing.step &&
      preset.typography.letterSpacing.count === typography.letterSpacing.count &&
      preset.typography.letterSpacing.unit === typography.letterSpacing.unit,
  );
  return {
    ...DEFAULT_CONFIG,
    ...candidate,
    version: DEFAULT_CONFIG.version,
    primitiveLocks,
    color,
    scalePresetId: candidate.primitiveLocks?.scalePresetId
      ? candidate.scalePresetId
      : matchingScalePreset?.id,
    spacing,
    typography,
    radius: { ...DEFAULT_CONFIG.radius, ...candidate.radius },
    accessibility: { ...DEFAULT_CONFIG.accessibility, ...candidate.accessibility },
    overrides: {},
  };
}

function Field({
  label,
  hint,
  locked,
  onToggleLock,
  children,
}: {
  label: string;
  hint?: string;
  locked?: boolean;
  onToggleLock?: () => void;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">
        <span>{label}</span>
        <span className="field-label-actions">
          {hint && <span>{hint}</span>}
          {onToggleLock && (
            <button
              type="button"
              className={`field-lock${locked ? ' locked' : ''}`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onToggleLock();
              }}
              aria-label={`${locked ? 'Unlock' : 'Lock'} ${label}`}
              aria-pressed={locked}
              title={`${locked ? 'Unlock' : 'Lock'} ${label}`}
            >
              <Icon name={locked ? 'lock' : 'unlock'} size={11} />
            </button>
          )}
        </span>
      </span>
      {children}
    </label>
  );
}

function PrimaryColorControl({
  value,
  onCommit,
  onRandomize,
}: {
  value: string;
  onCommit: (value: string) => void;
  onRandomize: () => void;
}) {
  const [draft, setDraft] = useState(value.toUpperCase());

  useEffect(() => setDraft(value.toUpperCase()), [value]);

  const commit = () => {
    const normalized = normalizeHexInput(draft);
    if (normalized) onCommit(normalized);
    else setDraft(value.toUpperCase());
  };

  return (
    <div className="seed-input">
      <input
        className="color-picker"
        type="color"
        value={value}
        onChange={(event) => onCommit(event.target.value.toUpperCase())}
        aria-label="Pick primary color"
      />
      <input
        className="hex-input"
        value={draft}
        maxLength={7}
        spellCheck={false}
        aria-label="Primary color hex value"
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setDraft(event.target.value.toUpperCase())}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') {
            setDraft(value.toUpperCase());
            event.currentTarget.blur();
          }
        }}
      />
      <button
        type="button"
        className="randomize-button"
        onClick={onRandomize}
        title="Try another primary color"
      >
        <Icon name="spark" size={13} /> Randomize
      </button>
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <div className="number-wrap">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(Math.max(min, Math.min(max, next)));
        }}
      />
      {suffix && <span>{suffix}</span>}
    </div>
  );
}

function normalizeHexInput(value: string): string | null {
  const candidate = value.trim().replace(/^#/, '').toUpperCase();
  if (/^[0-9A-F]{3}$/.test(candidate)) {
    return `#${candidate
      .split('')
      .map((character) => character.repeat(2))
      .join('')}`;
  }
  return /^[0-9A-F]{6}$/.test(candidate) ? `#${candidate}` : null;
}

function PaletteHexInput({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value.toUpperCase());
  const normalized = normalizeHexInput(draft);

  useEffect(() => {
    setDraft(value.toUpperCase());
  }, [value]);

  const commit = () => {
    if (normalized) {
      setDraft(normalized);
      onCommit(normalized);
    } else {
      setDraft(value.toUpperCase());
    }
  };

  return (
    <input
      className="palette-hex-input"
      value={draft}
      maxLength={7}
      spellCheck={false}
      aria-label={`${label} hex color`}
      aria-invalid={!normalized}
      title="Paste a 3- or 6-digit hex color"
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => setDraft(event.target.value.toUpperCase())}
      onPaste={(event) => {
        const pasted = normalizeHexInput(event.clipboardData.getData('text'));
        if (!pasted) return;
        event.preventDefault();
        setDraft(pasted);
        onCommit(pasted);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') {
          setDraft(value.toUpperCase());
          event.currentTarget.blur();
        }
      }}
    />
  );
}

function ConfigPanel({
  config,
  setConfig,
  onImport,
  fontFamilies,
}: {
  config: TokenConfig;
  setConfig: React.Dispatch<React.SetStateAction<TokenConfig>>;
  onImport: () => void;
  fontFamilies: string[];
}) {
  const anchorChange = (
    field: PrimitiveField,
    update: (current: TokenConfig) => TokenConfig,
  ) => {
    setConfig((current) => {
      const edited = setPrimitiveLock(update(current), field, true);
      return primitiveChangeInfluence(field, current, edited) === 'system'
        ? composeDirection(edited, fontFamilies)
        : edited;
    });
  };

  const togglePrimitiveLock = (field: PrimitiveField) => {
    setConfig((current) => {
      const shouldLock = !isPrimitiveLocked(current, field);
      return setPrimitiveLock(current, field, shouldLock);
    });
  };

  const anchorProps = (field: PrimitiveField) => ({
    locked: isPrimitiveLocked(config, field),
    onToggleLock: () => togglePrimitiveLock(field),
  });

  const generateDirection = () =>
    setConfig((current) => composeDirection(current, fontFamilies));

  const choosePreset = (preset: (typeof PRESETS)[number]) => {
    setConfig((current) => {
      let next: TokenConfig = {
        ...current,
        color: {
          ...current.color,
          seed: preset.seed,
          harmony: preset.harmony,
          neutralStrategy: preset.neutralStrategy,
          presetId: preset.id,
          paletteRevision: 0,
        },
      };
      for (const field of [
        'color.seed',
        'color.harmony',
        'color.neutralStrategy',
      ] as PrimitiveField[]) {
        next = setPrimitiveLock(next, field, true);
      }
      return composeDirection(next, fontFamilies);
    });
  };

  const updateColor = (
    field: Extract<PrimitiveField, `color.${string}`>,
    update: Partial<TokenConfig['color']>,
  ) =>
    anchorChange(field, (current) => ({
      ...current,
      color: { ...current.color, ...update, presetId: undefined },
    }));

  const randomizeColor = () =>
    updateColor('color.seed', {
      seed: randomSeedColor(),
      paletteRevision: 0,
    });

  const chooseScalePreset = (presetId: string) => {
    if (presetId === 'custom') {
      setConfig((current) =>
        setPrimitiveLock({ ...current, scalePresetId: undefined }, 'scalePresetId', false),
      );
      return;
    }
    const preset = SCALE_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    anchorChange('scalePresetId', (current) => ({
      ...current,
      scalePresetId: preset.id,
      spacing: { ...preset.spacing },
      typography: {
        ...current.typography,
        ...preset.typography,
        fontFamily: current.typography.fontFamily,
      },
    }));
  };

  const updateSpacing = (
    field: Extract<PrimitiveField, `spacing.${string}`>,
    update: Partial<TokenConfig['spacing']>,
  ) =>
    anchorChange(field, (current) => ({
      ...current,
      spacing: { ...current.spacing, ...update },
    }));

  const updateTypography = (
    field: Extract<PrimitiveField, `typography.${string}`>,
    update: Partial<TokenConfig['typography']>,
  ) =>
    anchorChange(field, (current) => ({
      ...current,
      typography: { ...current.typography, ...update },
    }));

  const updateFontFamily = (
    role: keyof TokenConfig['typography']['fontFamily'],
    value: string,
  ) =>
    anchorChange(`typography.fontFamily.${role}`, (current) => ({
      ...current,
      typography: {
        ...current.typography,
        fontFamily: {
          ...current.typography.fontFamily,
          [role]: value,
        },
      },
    }));

  const updateRadius = (
    field: Extract<PrimitiveField, `radius.${string}`>,
    update: Partial<TokenConfig['radius']>,
  ) =>
    anchorChange(field, (current) => ({
      ...current,
      radius: { ...current.radius, ...update },
    }));

  const fontFamilyOptions = useMemo(
    () =>
      [
        ...new Set([
          ...fontFamilies,
          ...Object.values(config.typography.fontFamily),
        ]),
      ].sort((first, second) =>
        first.localeCompare(second, undefined, { sensitivity: 'base' }),
      ),
    [config.typography.fontFamily, fontFamilies],
  );

  return (
    <aside className="config-panel">
      <div className="panel-scroll">
        <section className="direction-section">
          <div className="direction-copy">
            <span>START ANYWHERE</span>
            <strong>
              {config.directionId
                ? `${DIRECTION_PROFILES.find((profile) => profile.id === config.directionId)?.name ?? 'Generated'} direction`
                : 'Open direction'}
            </strong>
            <p>Change any value to anchor it. Unlocked primitives adapt around your choices.</p>
          </div>
          <button className="direction-button" onClick={generateDirection}>
            <Icon name="spark" size={14} /> Generate another direction
          </button>
          <small>{anchoredCount(config)} anchored</small>
        </section>
        <section className="config-section first">
          <div className="section-heading">
            <h2>Color</h2>
          </div>
          <div className="preset-grid" aria-label="Color presets">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                className={`preset ${config.color.presetId === preset.id ? 'selected' : ''}`}
                onClick={() => choosePreset(preset)}
                title={`${preset.name} · ${preset.seed}`}
              >
                <span style={{ background: preset.seed }} />
                <small>{preset.name}</small>
              </button>
            ))}
          </div>
          <Field label="Primary" {...anchorProps('color.seed')}>
            <PrimaryColorControl
              value={config.color.seed}
              onCommit={(seed) => updateColor('color.seed', { seed })}
              onRandomize={randomizeColor}
            />
          </Field>
          <div className="field-row">
            <Field label="Harmony" {...anchorProps('color.harmony')}>
              <select
                value={config.color.harmony}
                onChange={(event) =>
                  updateColor('color.harmony', {
                    harmony: event.target.value as TokenConfig['color']['harmony'],
                  })
                }
              >
                <option value="analogous">Analogous</option>
                <option value="complementary">Complementary</option>
                <option value="triadic">Triadic</option>
                <option value="split-complementary">Split complementary</option>
              </select>
            </Field>
            <Field label="Neutrals" {...anchorProps('color.neutralStrategy')}>
              <select
                value={config.color.neutralStrategy}
                onChange={(event) =>
                  updateColor('color.neutralStrategy', {
                    neutralStrategy: event.target.value as TokenConfig['color']['neutralStrategy'],
                  })
                }
              >
                <option value="tinted">Tinted</option>
                <option value="pure">Pure</option>
              </select>
            </Field>
          </div>
          <Field label="Ramp steps" hint="5–15" {...anchorProps('color.steps')}>
            <NumberInput
              value={config.color.steps}
              min={5}
              max={15}
              onChange={(steps) => updateColor('color.steps', { steps })}
            />
          </Field>
        </section>

        <section className="config-section">
          <h2 className="section-title">System</h2>
          <div className="scale-preset">
            <Field label="Density" hint="spacing + type" {...anchorProps('scalePresetId')}>
              <select
                value={config.scalePresetId ?? 'custom'}
                onChange={(event) => chooseScalePreset(event.target.value)}
              >
                {config.scalePresetId === undefined && <option value="custom">Custom</option>}
                {SCALE_PRESETS.map((preset) => (
                  <option value={preset.id} key={preset.id}>
                    {preset.name} — {preset.useCase}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="scale-block">
            <div className="scale-title"><span>Spacing</span><small>Modular</small></div>
            <div className="triple-fields">
              <Field label="Base" {...anchorProps('spacing.base')}><NumberInput value={config.spacing.base} min={1} max={32} suffix="px" onChange={(base) => updateSpacing('spacing.base', { base })} /></Field>
              <Field label="Ratio" {...anchorProps('spacing.ratio')}><NumberInput value={config.spacing.ratio} min={1} max={3} step={0.001} onChange={(ratio) => updateSpacing('spacing.ratio', { ratio })} /></Field>
              <Field label="Count" {...anchorProps('spacing.count')}><NumberInput value={config.spacing.count} min={1} max={16} onChange={(count) => updateSpacing('spacing.count', { count })} /></Field>
            </div>
          </div>
          <div className="scale-block">
            <div className="scale-title"><span>Typography</span><small>px + rem</small></div>
            <Field label="Primary font" {...anchorProps('typography.fontFamily.sans')}>
              <select
                value={config.typography.fontFamily.sans}
                onChange={(event) => updateFontFamily('sans', event.target.value)}
              >
                {fontFamilyOptions.map((family) => (
                  <option value={family} key={family}>{family}</option>
                ))}
              </select>
            </Field>
            <Field label="Serif font" {...anchorProps('typography.fontFamily.serif')}>
              <select
                value={config.typography.fontFamily.serif}
                onChange={(event) => updateFontFamily('serif', event.target.value)}
              >
                {fontFamilyOptions.map((family) => (
                  <option value={family} key={family}>{family}</option>
                ))}
              </select>
            </Field>
            <Field label="Mono font" {...anchorProps('typography.fontFamily.mono')}>
              <select
                value={config.typography.fontFamily.mono}
                onChange={(event) => updateFontFamily('mono', event.target.value)}
              >
                {fontFamilyOptions.map((family) => (
                  <option value={family} key={family}>{family}</option>
                ))}
              </select>
            </Field>
            <div className="triple-fields">
              <Field label="Base" {...anchorProps('typography.baseSize')}><NumberInput value={config.typography.baseSize} min={8} max={32} suffix="px" onChange={(baseSize) => updateTypography('typography.baseSize', { baseSize })} /></Field>
              <Field label="Ratio" {...anchorProps('typography.ratio')}><NumberInput value={config.typography.ratio} min={1} max={2} step={0.001} onChange={(ratio) => updateTypography('typography.ratio', { ratio })} /></Field>
              <Field label="Count" {...anchorProps('typography.count')}><NumberInput value={config.typography.count} min={1} max={12} onChange={(count) => updateTypography('typography.count', { count })} /></Field>
            </div>
          </div>
          <div className="scale-block">
            <div className="scale-title"><span>Radius</span><small>Modular</small></div>
            <div className="triple-fields">
              <Field label="Base" {...anchorProps('radius.base')}><NumberInput value={config.radius.base} min={0} max={32} suffix="px" onChange={(base) => updateRadius('radius.base', { base })} /></Field>
              <Field label="Ratio" {...anchorProps('radius.ratio')}><NumberInput value={config.radius.ratio} min={1} max={4} step={0.25} onChange={(ratio) => updateRadius('radius.ratio', { ratio })} /></Field>
              <Field label="Count" {...anchorProps('radius.count')}><NumberInput value={config.radius.count} min={1} max={12} onChange={(count) => updateRadius('radius.count', { count })} /></Field>
            </div>
          </div>
        </section>

        <button className="text-button import-button" onClick={onImport}>
          <Icon name="upload" /> Import recipe
        </button>
      </div>
    </aside>
  );
}

function RampPreview({
  tokenSet,
  config,
  setConfig,
  fontFamilies,
}: {
  tokenSet: TokenSet;
  config: TokenConfig;
  setConfig: React.Dispatch<React.SetStateAction<TokenConfig>>;
  fontFamilies: string[];
}) {
  const ramps = useMemo(() => {
    const result = new Map<string, TokenSet['tokens']>();
    tokenSet.tokens
      .filter((token) => token.type === 'COLOR')
      .forEach((token) => {
        const rampName = token.name.split('/')[1];
        result.set(rampName, [...(result.get(rampName) ?? []), token]);
      });
    return [...result.entries()];
  }, [tokenSet]);

  const setPaletteColor = (id: PaletteSlot, value: string) => {
    setConfig((current) => {
      const anchored = setPaletteAnchor(current, id, value);
      return id === 'primary'
        ? composeDirection(anchored, fontFamilies)
        : anchored;
    });
  };

  const togglePaletteLock = (id: PaletteSlot, value: string) => {
    setConfig((current) => togglePaletteAnchor(current, id, value));
  };

  const regeneratePalette = () => {
    setConfig((current) => ({
      ...current,
      color: {
        ...current.color,
        presetId: undefined,
        paletteRevision: (current.color.paletteRevision ?? 0) + 1,
      },
    }));
  };

  return (
    <div className="preview-stack">
      <div className="preview-intro">
        <h1>Color ramps</h1>
        <span className="token-count">{tokenSet.tokens.length} tokens</span>
      </div>
      <section className="palette-editor" aria-labelledby="palette-editor-title">
        <div className="palette-editor-head">
          <strong id="palette-editor-title">Palette</strong>
          <button className="palette-regenerate" onClick={regeneratePalette}>
            Regenerate palette
          </button>
        </div>
        <div className="palette-strip">
          {tokenSet.palette.map((color) => {
            const locked = isPaletteAnchorLocked(config, color.id);
            return (
              <div className="palette-color" key={color.id}>
                <div className="palette-swatch" style={{ background: color.value }}>
                  <input
                    className="palette-color-picker"
                    type="color"
                    value={color.value}
                    onChange={(event) => setPaletteColor(color.id, event.target.value)}
                    aria-label={`Adjust ${color.label}`}
                    title={`Adjust ${color.label}`}
                  />
                  <button
                    className={`palette-lock${locked ? ' locked' : ''}`}
                    onClick={() => togglePaletteLock(color.id, color.value)}
                    aria-label={`${locked ? 'Unlock' : 'Lock'} ${color.label}`}
                    aria-pressed={locked}
                    title={`${locked ? 'Unlock' : 'Lock'} ${color.label}`}
                  >
                    <Icon name={locked ? 'lock' : 'unlock'} size={14} />
                  </button>
                </div>
                <div className="palette-meta">
                  <strong>{color.label}</strong>
                  <PaletteHexInput
                    label={color.label}
                    value={color.value}
                    onCommit={(value) => setPaletteColor(color.id, value)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <div className="ramp-list">
        {ramps.map(([name, tokens]) => (
          <div className="ramp-row" key={name}>
            <div className="ramp-meta">
              <strong>{name.replace('-', ' ')}</strong>
              <small>{tokens.length} steps</small>
            </div>
            <div className="swatch-track">
              {tokens.map((token) => (
                <div
                  key={token.name}
                  className="swatch"
                  style={{ background: String(token.value) }}
                  title={`${token.name} · ${token.value}`}
                >
                  <span>{token.name.split('/')[token.name.split('/').length - 1]}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="scale-preview">
        <div className="scale-card">
          <span>Spacing</span>
          <div className="space-bars">
            {tokenSet.tokens.filter((t) => t.name.startsWith('space/')).slice(0, 7).map((token) => (
              <i key={token.name} style={{ width: `${Math.min(Number(token.value) * 1.25, 100)}%` }} />
            ))}
          </div>
        </div>
        <div className="scale-card type-sample">
          <span>Type scale</span>
          {tokenSet.tokens.filter((t) => t.name.startsWith('font-size/')).slice(0, 4).reverse().map((token) => (
            <b key={token.name} style={{ fontSize: `${Math.min(Number(token.value) * 0.54, 27)}px` }}>Aa</b>
          ))}
        </div>
        <div className="scale-card radius-sample">
          <span>Radius</span>
          <div>
            {tokenSet.tokens.filter((t) => t.name.startsWith('radius/')).slice(0, 5).map((token) => (
              <i key={token.name} style={{ borderRadius: `${Math.min(Number(token.value), 16)}px` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ContrastPanel({
  tokenSet,
  standard,
  onStandardChange,
}: {
  tokenSet: TokenSet;
  standard: 'AA' | 'AAA';
  onStandardChange: (value: 'AA' | 'AAA') => void;
}) {
  const guaranteed = tokenSet.contrast.filter((result) => result.guaranteed);
  const passing = guaranteed.filter((result) => (standard === 'AA' ? result.aa : result.aaa)).length;

  return (
    <div className="preview-stack">
      <div className="preview-intro contrast-heading">
        <h1>WCAG contrast</h1>
        <div className="segmented compact">
          {(['AA', 'AAA'] as const).map((item) => (
            <button className={standard === item ? 'active' : ''} key={item} onClick={() => onStandardChange(item)}>{item}</button>
          ))}
        </div>
      </div>
      <div className="contrast-summary">
        <span className="summary-icon"><Icon name="check" size={17} /></span>
        <div>
          <strong>{passing} of {guaranteed.length} guaranteed pairings pass {standard}</strong>
          <p>AA is enforced during generation. AAA is shown as an optional stricter audit.</p>
        </div>
      </div>
      <div className="contrast-table">
        <div className="contrast-table-head">
          <span>Foreground token</span><span>On</span><span>Ratio</span><span>{standard}</span>
        </div>
        {guaranteed.map((result) => {
          const pass = standard === 'AA' ? result.aa : result.aaa;
          return (
            <div className="contrast-table-row" key={`${result.foreground}-${result.background}`}>
              <span className="contrast-token">
                <i style={{ background: result.foregroundHex }} />
                {result.foreground.replace('color/', '')}
              </span>
              <span className="surface-chip" style={{ background: result.backgroundHex, color: result.background === 'white' ? '#111827' : '#fff' }}>
                {result.background === 'white' ? 'White' : 'Ink'}
              </span>
              <span className="ratio">{result.ratio.toFixed(2)}:1</span>
              <span className={`pass-pill ${pass ? 'pass' : 'fail'}`}>{pass ? 'Pass' : 'Review'}</span>
            </div>
          );
        })}
      </div>
      <p className="matrix-footnote">Contrast belongs to a pair, not a color. Arbitrary combinations are intentionally not certified.</p>
    </div>
  );
}

function RemovalDialog({
  removals,
  requestId,
  onClose,
}: {
  removals: RemovalCandidate[];
  requestId: string;
  onClose: () => void;
}) {
  const consumers = removals.reduce((sum, item) => sum + item.consumers, 0);
  const decide = (confirmed: boolean) => {
    post({ type: 'CONFIRM_REMOVALS', requestId, confirmed });
    if (!confirmed) onClose();
  };
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="removal-title">
        <span className="modal-alert"><Icon name="alert" size={20} /></span>
        <h2 id="removal-title">{removals.length} token{removals.length === 1 ? '' : 's'} will be removed</h2>
        <p className="modal-copy">
          {consumers > 0
            ? `${consumers} canvas layer${consumers === 1 ? '' : 's'} currently use these variables and will detach.`
            : 'No bound canvas layers were found, but removal cannot be undone by this plugin.'}
        </p>
        <div className="removal-list">
          {removals.slice(0, 6).map((item) => (
            <div key={item.id}><span>{item.name}</span><small>{item.consumers} bound layer{item.consumers === 1 ? '' : 's'}</small></div>
          ))}
          {removals.length > 6 && <div className="more-removals">+ {removals.length - 6} more</div>}
        </div>
        <div className="modal-actions">
          <button className="secondary-button" onClick={() => decide(false)}>Keep and regenerate</button>
          <button className="danger-button" onClick={() => decide(true)}>Remove and regenerate</button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [config, setConfig] = useState<TokenConfig>(DEFAULT_CONFIG);
  const [ready, setReady] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);
  const [tab, setTab] = useState<'preview' | 'contrast'>('preview');
  const [progress, setProgress] = useState<{ completed: number; total: number; label: string } | null>(null);
  const [summary, setSummary] = useState<WriteSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removal, setRemoval] = useState<{ requestId: string; removals: RemovalCandidate[] } | null>(null);
  const [fontFamilies, setFontFamilies] = useState<string[]>([]);
  const [placingGuide, setPlacingGuide] = useState(false);
  const [guidePlaced, setGuidePlaced] = useState(false);
  const [savedConfigSignature, setSavedConfigSignature] = useState('');
  const importInput = useRef<HTMLInputElement>(null);
  const pendingSaveSignature = useRef('');

  const generation = useMemo(() => {
    try {
      return { tokenSet: generate(config), error: null };
    } catch (generationError) {
      return {
        tokenSet: null,
        error: generationError instanceof Error ? generationError.message : 'Invalid recipe.',
      };
    }
  }, [config]);
  const lastValidTokenSet = useRef<TokenSet>(generate(DEFAULT_CONFIG));
  if (generation.tokenSet) lastValidTokenSet.current = generation.tokenSet;
  const visibleTokenSet = generation.tokenSet ?? lastValidTokenSet.current;

  useEffect(() => {
    const receive = (event: MessageEvent<{ pluginMessage?: MainToUiMessage }>) => {
      const message = event.data.pluginMessage;
      if (!message) return;
      if (message.type === 'INIT') {
        const normalized = normalizeImportedConfig(message.config);
        setConfig(normalized);
        setSavedConfigSignature(JSON.stringify(normalized));
        setHasExisting(message.hasExistingLibrary);
        setFontFamilies(message.fontFamilies);
        setReady(true);
      } else if (message.type === 'PROGRESS') {
        setProgress(message);
      } else if (message.type === 'REMOVAL_WARNING') {
        setProgress(null);
        setRemoval({ requestId: message.requestId, removals: message.removals });
      } else if (message.type === 'WRITE_COMPLETE') {
        setProgress(null);
        setRemoval(null);
        setSummary(message.summary);
        setHasExisting(true);
        setSavedConfigSignature(pendingSaveSignature.current);
        window.setTimeout(() => setSummary(null), 5000);
      } else if (message.type === 'STYLE_GUIDE_COMPLETE') {
        setPlacingGuide(false);
        setGuidePlaced(true);
        window.setTimeout(() => setGuidePlaced(false), 5000);
      } else if (message.type === 'ERROR') {
        setProgress(null);
        setPlacingGuide(false);
        setRemoval(null);
        setError(message.message);
      }
    };
    window.addEventListener('message', receive);
    if (parent === window) {
      setConfig(DEFAULT_CONFIG);
      setFontFamilies(Object.values(DEFAULT_CONFIG.typography.fontFamily));
      setReady(true);
    } else {
      post({ type: 'UI_READY' });
    }
    return () => window.removeEventListener('message', receive);
  }, []);

  const regenerate = () => {
    if (!generation.tokenSet) {
      setError(generation.error);
      return;
    }
    setError(null);
    setSummary(null);
    const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    pendingSaveSignature.current = JSON.stringify(config);
    setProgress({ completed: 0, total: generation.tokenSet.tokens.length, label: 'Comparing library' });
    post({ type: 'GENERATE', config, tokenSet: generation.tokenSet, requestId });
  };

  const libraryIsCurrent =
    hasExisting && savedConfigSignature === JSON.stringify(config);

  const placeStyleGuide = () => {
    if (!generation.tokenSet || !libraryIsCurrent) return;
    setError(null);
    setGuidePlaced(false);
    setPlacingGuide(true);
    post({ type: 'PLACE_STYLE_GUIDE', tokenSet: generation.tokenSet });
  };

  const importRecipe = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      setConfig(normalizeImportedConfig(parsed));
      setError(null);
      setSummary(null);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Could not import this file.');
    }
  };

  if (!ready) {
    return (
      <div className="loading">
        <span className="brand-mark"><Icon name="spark" size={18} /></span>
        <p>{generation.error ?? 'Loading your token recipe…'}</p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark"><Icon name="spark" size={17} /></span>
          <div><strong>Primitives</strong><span>Token Generator</span></div>
          <small>v1</small>
        </div>
        <div className="header-actions">
          <span className={`library-status ${hasExisting ? 'connected' : ''}`}>
            <i /> {hasExisting ? 'Library linked' : 'New library'}
          </span>
          <button className="icon-text-button" onClick={() => downloadJson('primitive-token-recipe.json', config)} title="Export recipe">
            <Icon name="download" /> Recipe
          </button>
          <button className="icon-text-button" onClick={() => downloadJson('primitive-tokens.tokens.json', toDtcg(visibleTokenSet))} title="Export DTCG tokens">
            <Icon name="download" /> DTCG
          </button>
        </div>
      </header>

      <main className="workspace">
        <ConfigPanel
          config={config}
          setConfig={setConfig}
          fontFamilies={fontFamilies}
          onImport={() => importInput.current?.click()}
        />
        <section className="preview-panel">
          <div className="preview-toolbar">
            <div className="segmented">
              <button className={tab === 'preview' ? 'active' : ''} onClick={() => setTab('preview')}>Palette</button>
              <button className={tab === 'contrast' ? 'active' : ''} onClick={() => setTab('contrast')}>Contrast</button>
            </div>
            <span>OKLCH · hue-preserving sRGB mapping</span>
          </div>
          <div className="preview-scroll">
            {tab === 'preview' ? (
              <RampPreview
                tokenSet={visibleTokenSet}
                config={config}
                setConfig={setConfig}
                fontFamilies={fontFamilies}
              />
            ) : (
              <ContrastPanel
                tokenSet={visibleTokenSet}
                standard={config.accessibility.standard}
                onStandardChange={(standard) => setConfig((current) => ({ ...current, accessibility: { standard } }))}
              />
            )}
          </div>
        </section>
      </main>

      <footer className="action-bar">
        <div className="action-status">
          {placingGuide ? (
            <>
              <span className="ready-dot active" />
              <span>Building style guide on canvas…</span>
            </>
          ) : progress ? (
            <>
              <div className="progress-track"><i style={{ width: `${Math.max(4, (progress.completed / progress.total) * 100)}%` }} /></div>
              <span>{progress.label} · {progress.completed}/{progress.total}</span>
            </>
          ) : (
            <>
              <span className="ready-dot" />
              <span>{visibleTokenSet.tokens.length} variables</span>
            </>
          )}
        </div>
        <div className="action-buttons">
          <button
            className="secondary-button guide-button"
            onClick={placeStyleGuide}
            disabled={Boolean(progress) || placingGuide || !libraryIsCurrent}
            title={
              libraryIsCurrent
                ? 'Place a complete primitive reference on the canvas'
                : 'Save the current library before placing its style guide'
            }
          >
            <Icon name="grid" />
            {placingGuide ? 'Placing…' : 'Place style guide'}
          </button>
          <button className="primary-button" onClick={regenerate} disabled={Boolean(progress) || placingGuide}>
            {progress ? 'Saving…' : 'Save library'}
          </button>
        </div>
      </footer>

      <input
        ref={importInput}
        className="visually-hidden"
        type="file"
        accept="application/json,.json"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importRecipe(file);
          event.currentTarget.value = '';
        }}
      />

      {removal && <RemovalDialog {...removal} onClose={() => setRemoval(null)} />}
      {summary && (
        <div className="toast success">
          <span><Icon name="check" /></span>
          <div><strong>Library is up to date</strong><p>{summary.updated} updated · {summary.added} added · {summary.removed} removed</p></div>
          <button onClick={() => setSummary(null)}>×</button>
        </div>
      )}
      {guidePlaced && (
        <div className="toast success">
          <span><Icon name="check" /></span>
          <div><strong>Style guide placed</strong><p>The generated frame is selected on the canvas.</p></div>
          <button onClick={() => setGuidePlaced(false)}>×</button>
        </div>
      )}
      {(error || generation.error) && (
        <div className="toast error">
          <span><Icon name="alert" /></span>
          <div><strong>Couldn’t continue</strong><p>{error ?? generation.error}</p></div>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
