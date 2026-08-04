import { describe, expect, it } from 'vitest';
import { diffTokens, type ExistingVariableSnapshot } from './diff';
import type { PrimitiveToken } from './types';

describe('diffTokens', () => {
  it('matches by stable name and separates changed, new, unchanged, and removed', () => {
    const existing: ExistingVariableSnapshot[] = [
      { id: 'stable-id', name: 'color/primary/500', type: 'COLOR', value: '#2d5bff' },
      { id: 'same-id', name: 'space/0', type: 'FLOAT', value: 4 },
      { id: 'remove-id', name: 'space/9', type: 'FLOAT', value: 153.8 },
    ];
    const generated: PrimitiveToken[] = [
      { name: 'color/primary/500', type: 'COLOR', value: '#7c3aed' },
      { name: 'space/0', type: 'FLOAT', value: 4 },
      { name: 'radius/0', type: 'FLOAT', value: 2 },
    ];

    const diff = diffTokens(generated, existing);
    expect(diff.changed[0].existing.id).toBe('stable-id');
    expect(diff.unchanged[0].existing.id).toBe('same-id');
    expect(diff.added[0].name).toBe('radius/0');
    expect(diff.removed[0].id).toBe('remove-id');
    expect(diff.summary).toEqual({ added: 1, updated: 1, unchanged: 1, removed: 1 });
  });
});
