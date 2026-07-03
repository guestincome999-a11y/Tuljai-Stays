import { existsSync } from 'node:fs';
import { join } from 'node:path';

const requiredPaths = [
  'apps/pilgrim-app',
  'apps/owner-app',
  'apps/admin-panel',
  'backend',
  'packages/ui',
  'packages/shared',
  'packages/utils',
  'packages/types',
  'docs',
];

const missingPaths = requiredPaths.filter(
  (workspacePath) => !existsSync(join(process.cwd(), workspacePath)),
);

if (missingPaths.length > 0) {
  console.error(`Missing required workspace paths: ${missingPaths.join(', ')}`);
  process.exit(1);
}

console.log('Tuljai Stays workspace structure is present.');
