// @vitest-environment node
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// Exercise the installed packages in a bounded process, without mocks or production data.
// These are dependency regressions, not claims that the application exposes these options.
const runNode = (script: string) => {
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import assert from 'node:assert/strict';
    ${script}
  `], { cwd: process.cwd(), encoding: "utf8", timeout: 10_000 });
  expect(result.error, result.stderr).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  expect(result.stderr).toBe("");
};

describe("installed root dependency security regressions", () => {
  it.each(["allowPrototypes", "plainObjects"])("serializes parsed constructor.isBuffer safely with %s", (option) => {
    runNode(`
      import qs from 'qs';
      const parsed = qs.parse('a[constructor][isBuffer]=yes', { ${option}: true });
      assert.equal(qs.stringify(parsed), 'a%5Bconstructor%5D%5BisBuffer%5D=yes');
      assert.equal(qs.stringify({ file: Buffer.from('hello') }), 'file=hello');
    `);
  });

  it.each(["a[]=x,y,z", "a=x,y&a=z,w", "a[]=x,y&a[]=z,w&a[]=p,q"])("enforces comma array limits for %s", (query) => {
    runNode(`
      import qs from 'qs';
      assert.throws(() => qs.parse(${JSON.stringify(query)}, {
        comma: true, arrayLimit: 2, throwOnLimitExceeded: true,
      }), RangeError);
      assert.deepEqual(qs.parse('a[]=x,y', {
        comma: true, arrayLimit: 2, throwOnLimitExceeded: true,
      }), { a: [['x', 'y']] });
      assert.deepEqual(qs.parse('a[]=x,y&a[]=z,w', {
        comma: true, arrayLimit: 2, throwOnLimitExceeded: true,
      }), { a: [['x', 'y'], ['z', 'w']] });
    `);
  });

  it("rejects an oversized comma value before allocating its split array", () => {
    runNode(`
      import qs from 'qs';
      const split = String.prototype.split;
      let commaSplits = 0;
      String.prototype.split = function (separator, limit) {
        if (separator === ',') commaSplits++;
        return split.call(this, separator, limit);
      };
      try {
        assert.throws(() => qs.parse('a=x,y,z', {
          comma: true, arrayLimit: 2, throwOnLimitExceeded: true,
        }), RangeError);
      } finally {
        String.prototype.split = split;
      }
      assert.equal(commaSplits, 0);
    `);
  });

  it.each(["copy", "copyAll"])("preserves symlinks without copying external file contents through %s", (method) => {
    runNode(`
      import { hfs } from '@humanfs/node';
      import fs from 'node:fs/promises';
      import os from 'node:os';
      import path from 'node:path';
      const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tf-humanfs-'));
      try {
        const source = path.join(root, 'source');
        const destination = path.join(root, 'destination');
        const outside = path.join(root, 'outside.txt');
        await fs.mkdir(source);
        await fs.writeFile(outside, 'external fixture');
        await fs.writeFile(path.join(source, 'normal.txt'), 'normal fixture');
        await fs.symlink(outside, path.join(source, 'link'));
        if (${JSON.stringify(method)} === 'copy') {
          await hfs.copy(path.join(source, 'link'), destination);
          assert.equal((await fs.lstat(destination)).isSymbolicLink(), true);
          assert.equal(await fs.readlink(destination), outside);
        } else {
          await fs.symlink(path.join(root, 'missing'), path.join(source, 'dangling'));
          await hfs.copyAll(source, destination);
          assert.equal((await fs.lstat(path.join(destination, 'link'))).isSymbolicLink(), true);
          assert.equal(await fs.readlink(path.join(destination, 'link')), outside);
          assert.equal(await fs.readlink(path.join(destination, 'dangling')), path.join(root, 'missing'));
          assert.equal(await fs.readFile(path.join(destination, 'normal.txt'), 'utf8'), 'normal fixture');
        }
        assert.equal(await fs.readFile(outside, 'utf8'), 'external fixture');
        assert.equal(await hfs.isDirectory(source), true);
        const entries = [];
        for await (const entry of hfs.walk(source)) entries.push(entry.path);
        assert.ok(entries.includes('normal.txt'));
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    `);
  });

  it("rejects invalid entity names at creation and after mutation during strict XML serialization", () => {
    runNode(`
      import { DOMImplementation, XMLSerializer } from '@xmldom/xmldom';
      const document = new DOMImplementation().createDocument(null, 'root', null);
      const invalidName = 'amp;<injected/>';
      assert.throws(() => document.createEntityReference(invalidName), { code: 5 });
      const reference = document.createEntityReference('amp');
      document.documentElement.appendChild(reference);
      const serializer = new XMLSerializer();
      assert.equal(serializer.serializeToString(document, false, undefined, { requireWellFormed: true }), '<root>&amp;</root>');
      reference.nodeName = invalidName;
      assert.throws(() => serializer.serializeToString(document, false, undefined, { requireWellFormed: true }), { code: 11 });
    `);
  });

  it("preserves plist parsing and serialization for desktop metadata", () => {
    runNode(`
      import plist from 'plist';
      const metadata = {
        CFBundleName: 'Tender Flow – české & <projekty>',
        CFBundleURLTypes: [{ CFBundleURLSchemes: ['tenderflow'] }],
        Enabled: true, Count: 3,
      };
      assert.deepEqual(plist.parse(plist.build(metadata)), metadata);
    `);
  });

  it("preserves Express query and form parsing, OAuth values and prototype isolation", () => {
    runNode(`
      import express from 'express';
      import { createRequire } from 'node:module';
      const require = createRequire(import.meta.url);
      assert.equal(require('express/package.json').version, '4.22.2');
      const app = express();
      app.use(express.urlencoded({ extended: true }));
      app.get('/echo', (req, res) => res.json(req.query));
      app.post('/echo', (req, res) => res.json(req.body));
      const server = app.listen(0, '127.0.0.1');
      await new Promise(resolve => server.once('listening', resolve));
      const base = 'http://127.0.0.1:' + server.address().port;
      const query = 'scope=a,b&scope=c&filter[name]=%C4%8Desk%C3%BD+projekt&state=a%2Bb%2Fc%3D&redirect_uri=https%3A%2F%2Fexample.test%2Fcallback%3Fnext%3D%252Fprojects&__proto__[polluted]=yes';
      const expected = { scope: ['a,b', 'c'], filter: { name: 'český projekt' }, state: 'a+b/c=', redirect_uri: 'https://example.test/callback?next=%2Fprojects' };
      try {
        const get = await fetch(base + '/echo?' + query);
        assert.equal(get.status, 200);
        assert.deepEqual(await get.json(), expected);
        const post = await fetch(base + '/echo', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: query });
        assert.equal(post.status, 200);
        assert.deepEqual(await post.json(), expected);
        assert.equal(Object.prototype.polluted, undefined);
        const malformed = await fetch(base + '/echo?value=%E0%A4%A&nested[a][b]=ok');
        assert.equal(malformed.status, 200);
        assert.deepEqual(await malformed.json(), { value: '%E0%A4%A', nested: { a: { b: 'ok' } } });
      } finally {
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      }
    `);
  });
});
