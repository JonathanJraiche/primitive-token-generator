import type { PrimitiveToken, TokenSet } from './shared/types';

const GUIDE_NAME = 'Primitives · Style guide';
const GUIDE_DATA_KEY = 'primitive-token-generator:style-guide';
const GUIDE_WIDTH = 1440;
const CONTENT_WIDTH = GUIDE_WIDTH - 128;
const INK = '#17191D';
const MUTED = '#6B707A';
const BORDER = '#D9DCE2';
const SURFACE = '#FFFFFF';
const CANVAS = '#F4F5F7';
const ACCENT = '#2D5BFF';

type Direction = 'HORIZONTAL' | 'VERTICAL';

interface GuideFonts {
  regular: FontName;
  strong: FontName;
  byFamily: Map<string, FontName>;
  byWeight: Map<number, FontName>;
}

function hexToRgb(hex: string): RGB {
  const value = hex.replace('#', '');
  return {
    r: parseInt(value.slice(0, 2), 16) / 255,
    g: parseInt(value.slice(2, 4), 16) / 255,
    b: parseInt(value.slice(4, 6), 16) / 255,
  };
}

function solid(hex: string): SolidPaint {
  return { type: 'SOLID', color: hexToRgb(hex) };
}

function stack(
  name: string,
  direction: Direction,
  width: number,
  gap: number,
  padding = 0,
  fill?: string,
): FrameNode {
  const frame = figma.createFrame();
  frame.name = name;
  frame.layoutMode = direction;
  frame.itemSpacing = gap;
  frame.paddingTop = padding;
  frame.paddingRight = padding;
  frame.paddingBottom = padding;
  frame.paddingLeft = padding;
  frame.primaryAxisAlignItems = 'MIN';
  frame.counterAxisAlignItems = 'MIN';
  frame.resize(width, 100);
  frame.primaryAxisSizingMode = direction === 'VERTICAL' ? 'AUTO' : 'FIXED';
  frame.counterAxisSizingMode = direction === 'VERTICAL' ? 'FIXED' : 'AUTO';
  frame.fills = fill ? [solid(fill)] : [];
  frame.clipsContent = false;
  return frame;
}

function text(
  characters: string,
  font: FontName,
  size: number,
  color = INK,
  width?: number,
): TextNode {
  const node = figma.createText();
  node.fontName = font;
  node.fontSize = size;
  node.characters = characters;
  node.fills = [solid(color)];
  node.lineHeight = { unit: 'PERCENT', value: 135 };
  if (width) {
    node.resize(width, Math.max(size * 1.5, 20));
    node.textAutoResize = 'HEIGHT';
  } else {
    node.textAutoResize = 'WIDTH_AND_HEIGHT';
  }
  return node;
}

function addSectionHeading(
  parent: FrameNode,
  title: string,
  fonts: GuideFonts,
): void {
  const heading = stack(`${title} · Heading`, 'VERTICAL', CONTENT_WIDTH, 6);
  heading.appendChild(text(title, fonts.strong, 28));
  parent.appendChild(heading);
}

function valueLabel(token: PrimitiveToken): string {
  if (token.type === 'COLOR') return String(token.value).toUpperCase();
  if (token.unit) return `${token.value}${token.unit}`;
  return String(token.value);
}

function bindPaint(node: GeometryMixin, variable: Variable): void {
  try {
    const current = Array.isArray(node.fills) && node.fills[0]?.type === 'SOLID'
      ? node.fills[0]
      : solid('#000000');
    node.fills = [figma.variables.setBoundVariableForPaint(current as SolidPaint, 'color', variable)];
  } catch {
    // The literal paint remains a useful preview if a variable cannot be bound.
  }
}

function bindNode(
  node: SceneNode & MinimalFillsMixin,
  field: 'width' | 'cornerRadius',
  variable: Variable,
): void {
  try {
    node.setBoundVariable(field, variable);
  } catch {
    // Some variable scopes or legacy files can reject bindings; preserve the literal preview.
  }
}

function bindText(
  node: TextNode,
  field: 'fontFamily' | 'fontSize' | 'fontWeight' | 'letterSpacing',
  variable: Variable,
): void {
  try {
    node.setBoundVariable(field, variable);
  } catch {
    // Keep the rendered sample when Figma cannot apply a text binding.
  }
}

function weightFromStyle(style: string): number {
  const normalized = style.toLowerCase().replace(/[\s-]/g, '');
  if (normalized.includes('thin')) return 100;
  if (normalized.includes('extralight') || normalized.includes('ultralight')) return 200;
  if (normalized.includes('light')) return 300;
  if (normalized.includes('medium')) return 500;
  if (normalized.includes('semibold') || normalized.includes('demibold')) return 600;
  if (normalized.includes('extrabold') || normalized.includes('ultrabold')) return 800;
  if (normalized.includes('black') || normalized.includes('heavy')) return 900;
  if (normalized.includes('bold')) return 700;
  return 400;
}

function isItalicStyle(style: string): boolean {
  return /italic|oblique/i.test(style);
}

function isRegularStyle(style: string): boolean {
  return /^(regular|roman|book)$/i.test(style.trim());
}

function findUprightFont(
  available: Awaited<ReturnType<typeof figma.listAvailableFontsAsync>>,
  family: string,
  weight: number,
): FontName | undefined {
  const matches = available
    .map(({ fontName }) => fontName)
    .filter(
      (fontName) =>
        fontName.family === family &&
        weightFromStyle(fontName.style) === weight &&
        !isItalicStyle(fontName.style),
    );
  if (weight === 400) {
    return matches.find((fontName) => isRegularStyle(fontName.style)) ?? matches[0];
  }
  return matches[0];
}

async function loadGuideFonts(tokenSet: TokenSet): Promise<GuideFonts> {
  const available = await figma.listAvailableFontsAsync();
  if (available.length === 0) throw new Error('No fonts are available to build the style guide.');

  const regular =
    findUprightFont(available, 'Inter', 400) ??
    available
      .map(({ fontName }) => fontName)
      .find(
        (fontName) =>
          weightFromStyle(fontName.style) === 400 &&
          isRegularStyle(fontName.style) &&
          !isItalicStyle(fontName.style),
      ) ??
    available.map(({ fontName }) => fontName).find((fontName) => !isItalicStyle(fontName.style)) ??
    available[0].fontName;
  const strong =
    findUprightFont(available, regular.family, 700) ?? regular;

  const byFamily = new Map<string, FontName>();
  const familyTokens = tokenSet.tokens.filter((token) => token.name.startsWith('font-family/'));
  for (const token of familyTokens) {
    const family = String(token.value);
    const match = findUprightFont(available, family, 400) ?? regular;
    byFamily.set(family, match);
  }

  const byWeight = new Map<number, FontName>();
  const weightTokens = tokenSet.tokens.filter((token) => token.name.startsWith('font-weight/'));
  for (const token of weightTokens) {
    const weight = Number(token.value);
    const match = findUprightFont(available, regular.family, weight) ?? regular;
    byWeight.set(weight, match);
  }

  const unique = new Map<string, FontName>();
  for (const font of [regular, strong, ...byFamily.values(), ...byWeight.values()]) {
    unique.set(`${font.family}:${font.style}`, font);
  }
  await Promise.all([...unique.values()].map((font) => figma.loadFontAsync(font)));

  return { regular, strong, byFamily, byWeight };
}

function tokenVariable(
  token: PrimitiveToken,
  variablesByName: Map<string, Variable>,
): Variable | undefined {
  const variable = variablesByName.get(token.name);
  return variable?.resolvedType === token.type ? variable : undefined;
}

function colorSection(
  guide: FrameNode,
  tokens: PrimitiveToken[],
  variablesByName: Map<string, Variable>,
  fonts: GuideFonts,
): void {
  const section = stack('Colors', 'VERTICAL', CONTENT_WIDTH, 28);
  addSectionHeading(
    section,
    'Color',
    fonts,
  );

  const groups = new Map<string, PrimitiveToken[]>();
  for (const token of tokens.filter((item) => item.type === 'COLOR')) {
    const family = token.name.split('/')[1] ?? 'color';
    const group = groups.get(family) ?? [];
    group.push(token);
    groups.set(family, group);
  }

  for (const [family, familyTokens] of groups) {
    const group = stack(`Color · ${family}`, 'VERTICAL', CONTENT_WIDTH, 10);
    group.appendChild(text(family.replace(/-/g, ' '), fonts.strong, 14));
    const row = stack(`Swatches · ${family}`, 'HORIZONTAL', CONTENT_WIDTH, 8);
    const cardWidth = Math.floor((CONTENT_WIDTH - (familyTokens.length - 1) * 8) / familyTokens.length);
    for (const token of familyTokens) {
      const card = stack(token.name, 'VERTICAL', cardWidth, 8);
      const swatch = figma.createRectangle();
      swatch.name = `${token.name} · Swatch`;
      swatch.resize(cardWidth, 88);
      swatch.cornerRadius = 8;
      swatch.fills = [solid(String(token.value))];
      const variable = tokenVariable(token, variablesByName);
      if (variable) bindPaint(swatch, variable);
      card.appendChild(swatch);
      const nameParts = token.name.split('/');
      card.appendChild(text(nameParts[nameParts.length - 1] ?? token.name, fonts.strong, 12));
      card.appendChild(text(valueLabel(token), fonts.regular, 10, MUTED));
      row.appendChild(card);
    }
    group.appendChild(row);
    section.appendChild(group);
  }
  guide.appendChild(section);
}

function primitiveCard(
  token: PrimitiveToken,
  variable: Variable | undefined,
  fonts: GuideFonts,
  width: number,
): FrameNode {
  const card = stack(token.name, 'VERTICAL', width, 16, 20, SURFACE);
  card.cornerRadius = 12;
  card.strokes = [solid(BORDER)];
  card.strokeWeight = 1;

  const label = stack(`${token.name} · Label`, 'VERTICAL', width - 40, 3);
  label.appendChild(text(token.name, fonts.strong, 12));
  label.appendChild(text(valueLabel(token), fonts.regular, 11, MUTED));
  card.appendChild(label);

  const preview = stack(`${token.name} · Preview`, 'VERTICAL', width - 40, 8);
  const category = token.name.split('/')[0];

  if (category === 'space') {
    const bar = figma.createRectangle();
    bar.name = `${token.name} · Spacing`;
    bar.resize(Math.max(2, Number(token.value)), 18);
    bar.cornerRadius = 4;
    bar.fills = [solid(ACCENT)];
    if (variable) bindNode(bar, 'width', variable);
    preview.appendChild(bar);
  } else if (category === 'radius') {
    const shape = figma.createRectangle();
    shape.name = `${token.name} · Radius`;
    shape.resize(88, 56);
    shape.cornerRadius = Math.min(Number(token.value), 28);
    shape.fills = [solid('#DCE5FF')];
    shape.strokes = [solid(ACCENT)];
    if (variable) bindNode(shape, 'cornerRadius', variable);
    preview.appendChild(shape);
  } else if (category === 'font-family') {
    const family = String(token.value);
    const sample = text('Sphinx of black quartz', fonts.byFamily.get(family) ?? fonts.regular, 18);
    if (variable) bindText(sample, 'fontFamily', variable);
    preview.appendChild(sample);
  } else if (category === 'font-size') {
    const sample = text('Ag', fonts.regular, Number(token.value));
    if (variable) bindText(sample, 'fontSize', variable);
    preview.appendChild(sample);
  } else if (category === 'font-size-rem') {
    preview.appendChild(text('Ag', fonts.regular, Math.min(Number(token.value) * 16, 72)));
    preview.appendChild(text('Rendered against a 16px reference', fonts.regular, 10, MUTED));
  } else if (category === 'font-weight') {
    const weight = Number(token.value);
    const sample = text('Design systems stay coherent', fonts.byWeight.get(weight) ?? fonts.regular, 18);
    if (variable) bindText(sample, 'fontWeight', variable);
    preview.appendChild(sample);
  } else if (category === 'line-height') {
    const sample = text('Line one shows the rhythm.\nLine two makes it visible.', fonts.regular, 16, INK, width - 40);
    sample.lineHeight = { unit: 'PIXELS', value: Number(token.value) * 16 };
    preview.appendChild(sample);
  } else if (category === 'letter-spacing') {
    const sample = text('TRACKING', fonts.strong, 18);
    sample.letterSpacing = token.unit === 'rem'
      ? { unit: 'PIXELS', value: Number(token.value) * 16 }
      : { unit: 'PIXELS', value: Number(token.value) };
    if (variable && token.unit !== 'rem') bindText(sample, 'letterSpacing', variable);
    preview.appendChild(sample);
  } else {
    preview.appendChild(text(valueLabel(token), fonts.regular, 18));
  }

  card.appendChild(preview);
  return card;
}

function primitiveSections(
  guide: FrameNode,
  tokens: PrimitiveToken[],
  variablesByName: Map<string, Variable>,
  fonts: GuideFonts,
): void {
  const definitions: Array<{ title: string; categories: string[] }> = [
    {
      title: 'Spacing & shape',
      categories: ['space', 'radius'],
    },
    {
      title: 'Typography',
      categories: [
        'font-family',
        'font-size',
        'font-size-rem',
        'font-weight',
        'line-height',
        'letter-spacing',
      ],
    },
  ];

  for (const definition of definitions) {
    const section = stack(definition.title, 'VERTICAL', CONTENT_WIDTH, 22);
    addSectionHeading(section, definition.title, fonts);
    const selected = tokens.filter((token) =>
      definition.categories.includes(token.name.split('/')[0]),
    );
    for (let index = 0; index < selected.length; index += 4) {
      const row = stack(`${definition.title} · Row ${index / 4 + 1}`, 'HORIZONTAL', CONTENT_WIDTH, 16);
      const rowTokens = selected.slice(index, index + 4);
      const cardWidth = (CONTENT_WIDTH - 48) / 4;
      for (const token of rowTokens) {
        row.appendChild(
          primitiveCard(
            token,
            tokenVariable(token, variablesByName),
            fonts,
            cardWidth,
          ),
        );
      }
      section.appendChild(row);
    }
    guide.appendChild(section);
  }
}

export async function createStyleGuide(
  tokenSet: TokenSet,
  collection: VariableCollection,
  variablesByName: Map<string, Variable>,
): Promise<FrameNode> {
  const missing = tokenSet.tokens.filter((token) => !variablesByName.has(token.name));
  if (missing.length > 0) {
    throw new Error('Save the current library before placing its style guide.');
  }

  const fonts = await loadGuideFonts(tokenSet);
  const guide = stack(GUIDE_NAME, 'VERTICAL', GUIDE_WIDTH, 56, 64, CANVAS);
  guide.setPluginData(GUIDE_DATA_KEY, 'managed');
  guide.setPluginData('collection-id', collection.id);

  const eyebrow = text('PRIMITIVE TOKEN LIBRARY', fonts.strong, 11, ACCENT);
  eyebrow.letterSpacing = { unit: 'PERCENT', value: 12 };
  guide.appendChild(eyebrow);

  colorSection(guide, tokenSet.tokens, variablesByName, fonts);
  primitiveSections(guide, tokenSet.tokens, variablesByName, fonts);

  const bounds = figma.viewport.bounds;
  guide.x = Math.round(bounds.x + bounds.width + 80);
  guide.y = Math.round(bounds.y);
  figma.currentPage.selection = [guide];
  figma.viewport.scrollAndZoomIntoView([guide]);
  return guide;
}
