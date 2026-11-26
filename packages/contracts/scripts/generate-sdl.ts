import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderSdlFiles } from '../src/sdl/generate.ts';

const repoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
);
const check = process.argv.includes('--check');

let drifted = false;
for (const { target, contents } of renderSdlFiles()) {
  const path = resolve(repoRoot, target);

  if (!check) {
    await writeFile(path, contents);
    console.log(`wrote ${target}`);
    continue;
  }

  const current = await readFile(path, 'utf8');
  if (current === contents) {
    console.log(`ok    ${target}`);
  } else {
    drifted = true;
    console.error(`drift ${target} — run \`npm run generate:sdl\` in packages/contracts`);
  }
}

if (check && drifted) {
  console.error(
    'SDL drift: the checked-in .graphql files do not match the wire registry.',
  );
  process.exit(1);
}
