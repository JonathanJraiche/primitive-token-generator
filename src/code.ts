import { DEFAULT_CONFIG } from './shared/defaults';
import { diffTokens, type ExistingVariableSnapshot, type TokenDiff } from './shared/diff';
import { createStyleGuide } from './style-guide';
import type {
  MainToUiMessage,
  PrimitiveToken,
  RemovalCandidate,
  TokenConfig,
  TokenSet,
  UiToMainMessage,
} from './shared/types';

const COLLECTION_NAME = 'Primitive tokens';
const COLLECTION_ID_KEY = 'primitive-token-generator:collection-id';
const CONFIG_KEY = 'primitive-token-generator:config';
const PLUGIN_DATA_KEY = 'primitive-token-generator';
const META_VARIABLE_NAME = '_meta/primitive-token-generator';
const WRITE_CHUNK = 24;

interface PendingWrite {
  requestId: string;
  config: TokenConfig;
  tokenSet: TokenSet;
  collection: VariableCollection;
  variablesByName: Map<string, Variable>;
  diff: TokenDiff;
}

let pendingWrite: PendingWrite | null = null;

figma.showUI(__html__, { width: 860, height: 720, themeColors: true });

function post(message: MainToUiMessage): void {
  figma.ui.postMessage(message);
}

function hexToFigmaColor(hex: string): RGBA {
  const normalized = hex.replace('#', '');
  return {
    r: parseInt(normalized.slice(0, 2), 16) / 255,
    g: parseInt(normalized.slice(2, 4), 16) / 255,
    b: parseInt(normalized.slice(4, 6), 16) / 255,
    a: 1,
  };
}

function figmaColorToHex(value: RGB | RGBA): string {
  const channel = (number: number) => Math.round(number * 255).toString(16).padStart(2, '0');
  return `#${channel(value.r)}${channel(value.g)}${channel(value.b)}`;
}

function toVariableValue(token: PrimitiveToken): VariableValue {
  if (token.type === 'COLOR') return hexToFigmaColor(String(token.value));
  return token.value;
}

async function findManagedCollection(): Promise<VariableCollection | null> {
  const storedId = await figma.clientStorage.getAsync(COLLECTION_ID_KEY);
  if (typeof storedId === 'string') {
    const stored = await figma.variables.getVariableCollectionByIdAsync(storedId);
    if (stored && !stored.remote) return stored;
  }

  const localCollections = await figma.variables.getLocalVariableCollectionsAsync();
  return (
    localCollections.find(
      (collection) => collection.getPluginData(PLUGIN_DATA_KEY) === 'managed',
    ) ?? null
  );
}

async function getOrCreateCollection(): Promise<VariableCollection> {
  const existing = await findManagedCollection();
  if (existing) return existing;
  const collection = figma.variables.createVariableCollection(COLLECTION_NAME);
  collection.setPluginData(PLUGIN_DATA_KEY, 'managed');
  await figma.clientStorage.setAsync(COLLECTION_ID_KEY, collection.id);
  return collection;
}

async function managedVariables(collection: VariableCollection): Promise<Variable[]> {
  const local = await figma.variables.getLocalVariablesAsync();
  return local.filter(
    (variable) =>
      variable.variableCollectionId === collection.id && variable.name !== META_VARIABLE_NAME,
  );
}

function snapshot(variable: Variable, modeId: string): ExistingVariableSnapshot {
  const raw = variable.valuesByMode[modeId];
  let value: ExistingVariableSnapshot['value'] = raw as ExistingVariableSnapshot['value'];
  if (variable.resolvedType === 'COLOR' && raw && typeof raw === 'object' && 'r' in raw) {
    value = figmaColorToHex(raw as RGB | RGBA);
  }
  return {
    id: variable.id,
    name: variable.name,
    type: variable.resolvedType as ExistingVariableSnapshot['type'],
    value,
  };
}

function collectAliasIds(value: unknown, targets: Set<string>, found: Set<string>): void {
  if (!value || typeof value !== 'object') return;
  if ('id' in value && typeof value.id === 'string' && targets.has(value.id)) {
    found.add(value.id);
  }
  for (const nested of Object.values(value)) {
    if (Array.isArray(nested)) nested.forEach((item) => collectAliasIds(item, targets, found));
    else if (nested && typeof nested === 'object') collectAliasIds(nested, targets, found);
  }
}

async function removalCandidates(variables: Variable[]): Promise<RemovalCandidate[]> {
  if (variables.length === 0) return [];
  await figma.loadAllPagesAsync();
  const targetIds = new Set(variables.map((variable) => variable.id));
  const counts = new Map(variables.map((variable) => [variable.id, 0]));

  figma.root.findAll((node) => {
    if (!('boundVariables' in node) || !node.boundVariables) return false;
    const found = new Set<string>();
    collectAliasIds(node.boundVariables, targetIds, found);
    for (const id of found) counts.set(id, (counts.get(id) ?? 0) + 1);
    return false;
  });

  return variables.map((variable) => ({
    id: variable.id,
    name: variable.name,
    consumers: counts.get(variable.id) ?? 0,
  }));
}

async function yieldToFigma(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

async function persistRecipe(collection: VariableCollection, config: TokenConfig): Promise<void> {
  const payload = JSON.stringify({ collectionId: collection.id, config });
  collection.setPluginData(CONFIG_KEY, JSON.stringify(config));
  collection.setPluginData(PLUGIN_DATA_KEY, 'managed');
  await figma.clientStorage.setAsync(CONFIG_KEY, config);
  await figma.clientStorage.setAsync(COLLECTION_ID_KEY, collection.id);

  const local = await figma.variables.getLocalVariablesAsync('STRING');
  let metadata = local.find(
    (variable) =>
      variable.variableCollectionId === collection.id && variable.name === META_VARIABLE_NAME,
  );
  if (!metadata) {
    metadata = figma.variables.createVariable(META_VARIABLE_NAME, collection, 'STRING');
    metadata.description = 'Portable generation recipe. Managed by Primitive Token Generator.';
    metadata.hiddenFromPublishing = true;
  }
  metadata.setValueForMode(collection.defaultModeId, payload);
}

async function executeWrite(write: PendingWrite, removeMissing: boolean): Promise<void> {
  const { collection, config, diff, variablesByName } = write;
  const changes = [...diff.changed.map((entry) => entry.token), ...diff.added];
  const removals = removeMissing ? diff.removed : [];
  const total = changes.length + removals.length + 1;
  let completed = 0;

  for (let index = 0; index < changes.length; index += WRITE_CHUNK) {
    const chunk = changes.slice(index, index + WRITE_CHUNK);
    for (const token of chunk) {
      const existing = variablesByName.get(token.name);
      if (existing) {
        if (existing.resolvedType !== token.type) {
          throw new Error(
            `${token.name} changed type from ${existing.resolvedType} to ${token.type}; preserving its ID is not possible.`,
          );
        }
        existing.setValueForMode(collection.defaultModeId, toVariableValue(token));
        existing.description = token.description ?? '';
      } else {
        const created = figma.variables.createVariable(token.name, collection, token.type);
        created.setValueForMode(collection.defaultModeId, toVariableValue(token));
        created.description = token.description ?? '';
        variablesByName.set(token.name, created);
      }
      completed += 1;
    }
    post({ type: 'PROGRESS', completed, total, label: 'Writing tokens' });
    await yieldToFigma();
  }

  for (let index = 0; index < removals.length; index += WRITE_CHUNK) {
    const chunk = removals.slice(index, index + WRITE_CHUNK);
    for (const item of chunk) {
      variablesByName.get(item.name)?.remove();
      completed += 1;
    }
    post({ type: 'PROGRESS', completed, total, label: 'Removing confirmed tokens' });
    await yieldToFigma();
  }

  await persistRecipe(collection, config);
  post({ type: 'PROGRESS', completed: total, total, label: 'Saved recipe' });
  post({
    type: 'WRITE_COMPLETE',
    summary: { ...diff.summary, removed: removeMissing ? diff.removed.length : 0 },
  });
  figma.notify(
    `${diff.summary.updated} updated · ${diff.summary.added} added · ${
      removeMissing ? diff.summary.removed : 0
    } removed`,
  );
}

async function prepareWrite(
  config: TokenConfig,
  tokenSet: TokenSet,
  requestId: string,
): Promise<void> {
  const collection = await getOrCreateCollection();
  const variables = await managedVariables(collection);
  const variablesByName = new Map(variables.map((variable) => [variable.name, variable]));
  const existing = variables.map((variable) => snapshot(variable, collection.defaultModeId));
  const diff = diffTokens(tokenSet.tokens, existing);
  const incompatible = diff.changed.find(
    ({ token, existing: current }) => token.type !== current.type,
  );
  if (incompatible) {
    throw new Error(
      `${incompatible.token.name} changed type from ${incompatible.existing.type} to ${incompatible.token.type}; preserving its ID is not possible.`,
    );
  }

  pendingWrite = { requestId, config, tokenSet, collection, variablesByName, diff };
  if (diff.removed.length > 0) {
    const removedVariables = diff.removed
      .map((item) => variablesByName.get(item.name))
      .filter((variable): variable is Variable => Boolean(variable));
    const removals = await removalCandidates(removedVariables);
    post({ type: 'REMOVAL_WARNING', requestId, removals, summary: diff.summary });
    return;
  }

  await executeWrite(pendingWrite, false);
  pendingWrite = null;
}

async function initialConfig(): Promise<{ config: TokenConfig; hasExistingLibrary: boolean }> {
  const collection = await findManagedCollection();
  const stored = await figma.clientStorage.getAsync(CONFIG_KEY);
  if (stored && typeof stored === 'object') {
    return { config: stored as TokenConfig, hasExistingLibrary: Boolean(collection) };
  }
  if (collection) {
    const fromFile = collection.getPluginData(CONFIG_KEY);
    if (fromFile) {
      try {
        return { config: JSON.parse(fromFile) as TokenConfig, hasExistingLibrary: true };
      } catch {
        // Fall through to defaults when legacy or corrupt metadata is encountered.
      }
    }
  }
  return { config: DEFAULT_CONFIG, hasExistingLibrary: Boolean(collection) };
}

async function availableFontFamilies(): Promise<string[]> {
  try {
    const fonts = await figma.listAvailableFontsAsync();
    return [...new Set(fonts.map((font) => font.fontName.family).filter(Boolean))].sort(
      (first, second) => first.localeCompare(second, undefined, { sensitivity: 'base' }),
    );
  } catch {
    return [];
  }
}

figma.ui.onmessage = async (message: UiToMainMessage) => {
  try {
    if (message.type === 'UI_READY') {
      const [state, fontFamilies] = await Promise.all([
        initialConfig(),
        availableFontFamilies(),
      ]);
      post({ type: 'INIT', ...state, fontFamilies });
    } else if (message.type === 'GENERATE') {
      await prepareWrite(message.config, message.tokenSet, message.requestId);
    } else if (message.type === 'PLACE_STYLE_GUIDE') {
      const collection = await findManagedCollection();
      if (!collection) throw new Error('Save the library before placing its style guide.');
      const variables = await managedVariables(collection);
      const guide = await createStyleGuide(
        message.tokenSet,
        collection,
        new Map(variables.map((variable) => [variable.name, variable])),
      );
      post({ type: 'STYLE_GUIDE_COMPLETE', nodeId: guide.id });
      figma.notify('Style guide placed on the canvas.');
    } else if (message.type === 'CONFIRM_REMOVALS') {
      if (!pendingWrite || pendingWrite.requestId !== message.requestId) return;
      if (message.confirmed) await executeWrite(pendingWrite, true);
      else await executeWrite(pendingWrite, false);
      pendingWrite = null;
    } else if (message.type === 'RESIZE') {
      figma.ui.resize(
        Math.max(560, Math.min(message.width, 960)),
        Math.max(560, Math.min(message.height, 840)),
      );
    }
  } catch (error) {
    pendingWrite = null;
    post({
      type: 'ERROR',
      message: error instanceof Error ? error.message : 'An unexpected error occurred.',
    });
  }
};
