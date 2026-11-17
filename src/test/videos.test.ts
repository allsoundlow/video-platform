import { test, describe, it, after, before } from 'node:test';
import { createReadStream } from 'node:fs';
import { buildApp } from '../app.ts';

describe('file upload', async (s) => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  before(async () => {
    app = await buildApp();
  });
  after(async () => {
    await app.close();
  });
  it('accepts real mp4 video file', async (t) => {
    const res = await app.inject({
      method: 'POST',
      path: '/videos',
      headers: { 'content-type': 'video/mp4' },
      payload: createReadStream(new URL('./fixtures/demo3MB.mp4', import.meta.url)),
    });
    t.assert.equal(res.statusCode, 200);
    t.assert.deepEqual(res.json(), { extension: 'mp4' });
  });
});
