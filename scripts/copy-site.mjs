// Copies the static homepage into dist/ next to the built Finance Tracker app.
import { cpSync, existsSync } from 'node:fs';

const items = ['index.html', 'assets'];
for (const item of items) {
  if (existsSync(item)) cpSync(item, `dist/${item}`, { recursive: true });
}
console.log('Copied homepage files into dist/');
