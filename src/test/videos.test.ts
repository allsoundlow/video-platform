import { describe, it, after, before } from 'node:test';
import { createReadStream, ReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { buildApp } from '../app.ts';

const demoPath = new URL('./fixtures/demo3MB.mp4', import.meta.url);

describe('file upload', async (s) => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let hashedDemoHex: string;
  async function postVideo(payload: ReadStream | Buffer, contentType: string = 'video/mp4') {
    return await app.inject({
      method: 'POST',
      path: '/videos',
      headers: { 'content-type': `${contentType}` },
      payload,
    });
  }

  before(async () => {
    app = await buildApp();
    const input = await readFile(demoPath);
    hashedDemoHex = createHash('sha256').update(input).digest('hex');
  });
  after(async () => {
    await app.close();
  });
  it('failed on short file size', async (t) => {
    const res = await postVideo(Buffer.from([0x1a, 0x45]));
    t.assert.equal(res.statusCode, 415);
  });
  it('failed on invalid file type', async (t) => {
    const res = await postVideo(Buffer.from('InvalidVideoFile'));
    t.assert.equal(res.statusCode, 415);
  });
  it('detects webm extension', async (t) => {
    const res = await postVideo(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00]));
    const { extension } = res.json();
    t.assert.equal(extension, 'webm');
  });
  it('accepts real mp4 video file', async (t) => {
    const res = await postVideo(createReadStream(demoPath));
    const { extension, hash } = res.json();
    t.assert.equal(res.statusCode, 200);
    t.assert.equal(extension, 'mp4');
    t.assert.equal(hash, hashedDemoHex, 'equal hash');
  });
});
