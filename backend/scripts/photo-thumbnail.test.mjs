import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
require('ts-node').register({
  project: fileURLToPath(new URL('../tsconfig.json', import.meta.url)),
  transpileOnly: true,
});
const sharp = require('sharp');

const { createPhotoThumbnail } = require('../src/modules/photos/photo-thumbnail.ts');

test('thumbnail is bounded WebP, strips metadata and leaves source unchanged', async () => {
  const original = readFileSync(
    new URL('../../apps/pilgrim-app/assets/splash-screen.png', import.meta.url),
  );
  const before = Buffer.from(original);
  const result = await createPhotoThumbnail(original);
  const metadata = await sharp(result).metadata();
  assert.equal(metadata.format, 'webp');
  assert.ok(metadata.width <= 640 && metadata.height <= 480);
  assert.equal(metadata.exif, undefined);
  assert.ok(result.length < original.length);
  assert.deepEqual(original, before);
  console.log(
    `Thumbnail fixture: ${original.length} bytes -> ${result.length} bytes (${metadata.width}x${metadata.height})`,
  );
});

test('small images are not enlarged and concurrent work does not queue decoded images', async () => {
  const input = await sharp({
    create: { width: 32, height: 16, channels: 3, background: '#f06020' },
  })
    .png()
    .toBuffer();
  const first = createPhotoThumbnail(input);
  const concurrent = await createPhotoThumbnail(input);
  assert.equal(concurrent, null);
  const output = await first;
  assert.equal((await sharp(output).metadata()).width, 32);
  await assert.rejects(createPhotoThumbnail(Buffer.from('not an image')));
  assert.ok(await createPhotoThumbnail(input));
});
