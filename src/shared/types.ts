export type Harmony = 'complementary' | 'analogous' | 'triadic' | 'split-complementary';
export type NeutralStrategy = 'pure' | 'tinted';
export type ContrastStandard = 'AA' | 'AAA';
export type ScalePresetId = 'dense' | 'compact' | 'balanced' | 'spacious' | 'editorial';
export type PaletteSlot = 'primary' | 'harmony-1' | 'harmony-2' | 'support-1' | 'support-2';
export type DirectionId = 'precise' | 'quiet' | 'friendly' | 'editorial' | 'bold' | 'organic';
export type PrimitiveField =
  | 'color.seed'
  | 'color.harmony'
  | 'color.neutralStrategy'
  | 'color.steps'
  | 'scalePresetId'
  | 'spacing.base'
  | 'spacing.ratio'
  | 'spacing.count'
  | 'typography.fontFamily.sans'
  | 'typography.fontFamily.serif'
  | 'typography.fontFamily.mono'
  | 'typography.baseSize'
  | 'typography.ratio'
  | 'typography.count'
  | 'radius.base'
  | 'radius.ratio'
  | 'radius.count';

export interface TypographyConfig {
  baseSize: number;
  ratio: number;
  count: number;
  remBase: number;
  fontFamily: {
    sans: string;
    serif: string;
    mono: string;
  };
  lineHeight: {
    base: number;
    step: number;
    count: number;
  };
  fontWeight: {
    start: number;
    end: number;
    step: number;
  };
  letterSpacing: {
    base: number;
    step: number;
    count: number;
    unit: 'px' | 'rem';
  };
}

export interface TokenConfig {
  version: string;
  directionId?: DirectionId;
  primitiveLocks?: Partial<Record<PrimitiveField, true>>;
  color: {
    seed: string;
    harmony: Harmony;
    neutralStrategy: NeutralStrategy;
    steps: number;
    presetId?: string;
    paletteRevision: number;
    locks: Partial<Record<PaletteSlot, string>>;
  };
  scalePresetId?: ScalePresetId;
  spacing: { base: number; ratio: number; count: number };
  typography: TypographyConfig;
  radius: { base: number; ratio: number; count: number };
  accessibility: { standard: ContrastStandard };
  overrides?: Record<string, string>;
}

export type TokenType = 'COLOR' | 'FLOAT' | 'STRING';

export interface PrimitiveToken {
  name: string;
  type: TokenType;
  value: string | number;
  description?: string;
  unit?: 'px' | 'rem';
  dtcgType?: 'fontFamily' | 'fontWeight';
  oklch?: { l: number; c: number; h: number };
  extensions?: Record<string, unknown>;
}

export interface ContrastResult {
  foreground: string;
  background: 'white' | 'near-black';
  foregroundHex: string;
  backgroundHex: string;
  ratio: number;
  aa: boolean;
  aaa: boolean;
  largeText: boolean;
  guaranteed: boolean;
}

export interface TokenSet {
  configVersion: string;
  tokens: PrimitiveToken[];
  palette: Array<{
    id: PaletteSlot;
    label: string;
    value: string;
  }>;
  contrast: ContrastResult[];
  guarantees: string[];
}

export interface ColorPreset {
  id: string;
  name: string;
  seed: string;
  harmony: Harmony;
  neutralStrategy: NeutralStrategy;
}

export interface ScalePreset {
  id: ScalePresetId;
  name: string;
  useCase: string;
  spacing: TokenConfig['spacing'];
  typography: Omit<TokenConfig['typography'], 'fontFamily'>;
}

export interface WriteSummary {
  updated: number;
  added: number;
  unchanged: number;
  removed: number;
}

export interface RemovalCandidate {
  id: string;
  name: string;
  consumers: number;
}

export type MainToUiMessage =
  | {
      type: 'INIT';
      config: TokenConfig;
      hasExistingLibrary: boolean;
      fontFamilies: string[];
    }
  | { type: 'PROGRESS'; completed: number; total: number; label: string }
  | { type: 'REMOVAL_WARNING'; requestId: string; removals: RemovalCandidate[]; summary: WriteSummary }
  | { type: 'WRITE_COMPLETE'; summary: WriteSummary }
  | { type: 'STYLE_GUIDE_COMPLETE'; nodeId: string }
  | { type: 'ERROR'; message: string };

export type UiToMainMessage =
  | { type: 'UI_READY' }
  | { type: 'GENERATE'; config: TokenConfig; tokenSet: TokenSet; requestId: string }
  | { type: 'PLACE_STYLE_GUIDE'; tokenSet: TokenSet }
  | { type: 'CONFIRM_REMOVALS'; requestId: string; confirmed: boolean }
  | { type: 'RESIZE'; width: number; height: number };
