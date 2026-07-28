import type { PrimitiveToken, TokenType, WriteSummary } from './types';

export interface ExistingVariableSnapshot {
  id: string;
  name: string;
  type: TokenType;
  value: string | number | object | null;
}

export interface TokenDiff {
  added: PrimitiveToken[];
  changed: Array<{ token: PrimitiveToken; existing: ExistingVariableSnapshot }>;
  unchanged: Array<{ token: PrimitiveToken; existing: ExistingVariableSnapshot }>;
  removed: ExistingVariableSnapshot[];
  summary: WriteSummary;
}

const comparable = (value: ExistingVariableSnapshot['value'] | PrimitiveToken['value']) => {
  if (typeof value === 'number') return Math.round(value * 10000) / 10000;
  if (typeof value === 'string') return value.toLowerCase();
  return JSON.stringify(value);
};

export function diffTokens(tokens: PrimitiveToken[], existing: ExistingVariableSnapshot[]): TokenDiff {
  const existingByName = new Map(existing.map((item) => [item.name, item]));
  const tokenNames = new Set(tokens.map((token) => token.name));
  const added: PrimitiveToken[] = [];
  const changed: TokenDiff['changed'] = [];
  const unchanged: TokenDiff['unchanged'] = [];

  for (const token of tokens) {
    const current = existingByName.get(token.name);
    if (!current) {
      added.push(token);
    } else if (current.type !== token.type || comparable(current.value) !== comparable(token.value)) {
      changed.push({ token, existing: current });
    } else {
      unchanged.push({ token, existing: current });
    }
  }

  const removed = existing.filter((item) => !tokenNames.has(item.name));
  return {
    added,
    changed,
    unchanged,
    removed,
    summary: {
      added: added.length,
      updated: changed.length,
      unchanged: unchanged.length,
      removed: removed.length,
    },
  };
}
