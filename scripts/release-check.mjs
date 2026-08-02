import { access, readFile, readdir, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

const manifestPath = resolve(root, 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const packageMetadata = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));

check(typeof manifest.name === 'string' && manifest.name.trim().length > 0, 'Manifest name is missing.');
check(/^\d{10,}$/.test(String(manifest.id ?? '')), 'Manifest ID must be the numeric ID assigned by Figma.');
check(manifest.api === '1.0.0', 'Manifest API version must be 1.0.0.');
check(
  Array.isArray(manifest.editorType) && manifest.editorType.includes('figma'),
  'Manifest must support the Figma editor.',
);
check(
  manifest.documentAccess === 'dynamic-page',
  'Manifest must use dynamic-page document access.',
);
check(
  Array.isArray(manifest.networkAccess?.allowedDomains) &&
    manifest.networkAccess.allowedDomains.length === 1 &&
    manifest.networkAccess.allowedDomains[0] === 'none',
  'Manifest must explicitly declare no network access.',
);
check(!packageMetadata.author, 'Remove personal author metadata from package.json.');
check(!packageMetadata.contributors, 'Remove personal contributor metadata from package.json.');

async function textFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await textFiles(path));
    else if (/\.(?:css|html|js|json|md|mjs|svg|ts|tsx)$/i.test(entry.name)) files.push(path);
  }
  return files;
}

const sensitivePatterns = [
  { label: 'email address', pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i },
  { label: 'absolute user path', pattern: /(?:\/Users\/|\/home\/)[^/\s"']+/ },
  { label: 'AWS access key', pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { label: 'private key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { label: 'GitHub token', pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/ },
  { label: 'Slack token', pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { label: 'OpenAI-style secret key', pattern: /\bsk-[A-Za-z0-9_-]{16,}\b/ },
];

for (const path of await textFiles(root)) {
  if (path === fileURLToPath(import.meta.url) || path.endsWith('package-lock.json')) continue;
  const contents = await readFile(path, 'utf8');
  for (const { label, pattern } of sensitivePatterns) {
    check(!pattern.test(contents), `${label} found in ${path.slice(root.length + 1)}.`);
  }
}

const outputs = [manifest.main, manifest.ui].filter(
  (value) => typeof value === 'string',
);
for (const output of outputs) {
  const path = resolve(root, output);
  try {
    await access(path, constants.R_OK);
    const info = await stat(path);
    check(info.size > 0, `${output} is empty.`);
  } catch {
    failures.push(`${output} is missing. Run npm run build.`);
  }
}

const uiPath = resolve(root, String(manifest.ui));
try {
  const html = await readFile(uiPath, 'utf8');
  check(!/<script[^>]+src=/i.test(html), 'UI contains an external script reference.');
  check(
    !/<link[^>]+rel=["']stylesheet["']/i.test(html),
    'UI contains an external stylesheet reference.',
  );
} catch {
  // Missing output is reported above.
}

if (failures.length > 0) {
  console.error('Release check failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  const sizes = await Promise.all(
    outputs.map(async (output) => ({
      output,
      bytes: (await stat(resolve(root, output))).size,
    })),
  );
  console.log('Release check passed.');
  for (const { output, bytes } of sizes) {
    console.log(`- ${output}: ${(bytes / 1024).toFixed(1)} KB`);
  }
  console.log('- Network access: none');
  console.log('- Document access: dynamic-page');
}
