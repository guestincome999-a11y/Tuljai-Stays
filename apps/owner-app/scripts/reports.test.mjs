import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
function load(path, imports) {
  const exports = {};
  const source = readFileSync(new URL(`../src/features/reports/${path}`, import.meta.url), 'utf8');
  runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports,
      require: (name) => {
        assert.ok(name in imports, `Unexpected import ${name}`);
        return imports[name];
      },
    },
  );
  return exports;
}

test('owner PDF requests preserve applied dates, report type, and selected lodge', async () => {
  const calls = [];
  const { exportOwnerBookingReportPdf } = load('api/owner-reports-api.ts', {
    '../../../api/client': {
      apiClient: {
        get: async (...args) => {
          calls.push(args);
          return { base64: 'JVBERg==', filename: 'report.pdf' };
        },
      },
    },
  });
  const query = {
    startDate: '2026-11-01',
    endDate: '2026-11-12',
    reportType: 'completed',
    lodgeId: 'selected-lodge',
  };
  const result = await exportOwnerBookingReportPdf(query);
  assert.equal(calls[0][0], '/owner/reports/bookings/pdf');
  assert.equal(JSON.stringify(calls[0][1].params), JSON.stringify(query));
  assert.equal(calls[0][1].timeout, 120_000);
  assert.equal(result.filename, 'report.pdf');
});

function nativeSave(available = true, fail = false) {
  const calls = [];
  class File {
    exists = true;
    uri = 'file:///cache/report.pdf';
    create(options) {
      calls.push(['create', options]);
    }
    write(value, options) {
      calls.push(['write', value, options]);
    }
    delete() {
      this.exists = false;
      calls.push(['delete']);
    }
  }
  const api = load('utils/save-report-pdf.ts', {
    'expo-file-system': { File, Paths: { cache: 'cache' } },
    'expo-sharing': {
      isAvailableAsync: async () => available,
      shareAsync: async (...args) => {
        calls.push(['share', ...args]);
        if (fail) throw new Error('share failed');
      },
    },
    'react-native': { Platform: { OS: 'android' } },
  });
  return { ...api, calls };
}

test('native PDF sharing writes binary base64 and retains Android content until the receiver reads it', async () => {
  const save = nativeSave();
  await save.saveReportPdf({ base64: 'JVBERi0xLjM=', filename: 'report.pdf' });
  assert.equal(save.calls[1][0], 'write');
  assert.equal(save.calls[1][1], 'JVBERi0xLjM=');
  assert.equal(save.calls[1][2].encoding, 'base64');
  assert.equal(save.calls[2][2].mimeType, 'application/pdf');
  assert.equal(save.calls.at(-1)[0], 'share');
});

test('failed or unavailable native sharing surfaces the failure and removes temporary PDFs', async () => {
  for (const save of [nativeSave(false), nativeSave(true, true)]) {
    await assert.rejects(save.saveReportPdf({ base64: 'JVBERi0xLjM=', filename: 'report.pdf' }));
    assert.equal(save.calls.at(-1)[0], 'delete');
  }
});
