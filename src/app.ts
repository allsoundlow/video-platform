import Fastify from 'fastify';
import { z } from 'zod';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';

class FileUploadError extends Error {
  closeConnection: boolean;
  statusCode: number;
  constructor(message: string, statusCode: number = 415) {
    super(message);
    this.closeConnection = true;
    this.statusCode = statusCode;
  }
}
function getExtension(buff: Buffer) {
  if (buff.readUInt32BE(0) === 0x1a45dfa3) {
    return 'webm';
  }
  if (buff.readUInt32BE(4) === 0x66747970) {
    return 'mp4';
  }
  throw new FileUploadError(`File extension isn't supported`);
}

const HEADER_SIZE = 8;

const VideoUploadBody = z.object({ extension: z.enum(['webm', 'mp4']) });
type VideoUploadBody = z.infer<typeof VideoUploadBody>;

export async function buildApp() {
  const app = Fastify().withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.setErrorHandler(function (error, request, reply) {
    request.log.warn(`{error}`);
    let code = 500;
    let errorMessage = 'Internal Error';
    if (error instanceof FileUploadError) {
      if (error.closeConnection) {
        reply.header('connection', 'close');
      }
      code = error.statusCode;
      errorMessage = error.message;
    }
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    reply.code(code).send({ error: errorMessage });
  });

  app.addContentTypeParser(/^video\/([\w-]+);?/, function (request, payload, done) {
    let finished = false;
    let extension: string | undefined;
    const header = Buffer.alloc(HEADER_SIZE);
    let copied = 0;

    function finish(error: null | Error, data?: unknown) {
      if (finished) return;
      finished = true;
      done(error, data);
    }
    payload.on('data', (data: Buffer) => {
      if (finished || extension) return;
      copied += data.copy(header, copied, 0, HEADER_SIZE - copied);
      if (copied < HEADER_SIZE) return;
      try {
        extension = getExtension(header);
      } catch (e) {
        finish(e as Error, null);
      }
    });

    payload.on('end', () => {
      if (!extension) finish(new FileUploadError('File is too short'));
      finish(null, { extension });
    });

    payload.on('error', (err) => finish(err));
  });
  app.get('/health', async (req) => {
    console.log(`/health accepted`);
    return { status: 'ok', ts: new Date().toISOString() };
  });

  app.post(
    '/videos',
    {
      schema: {
        body: VideoUploadBody,
        response: { 200: z.object({ extension: z.enum(['webm', 'mp4']) }) },
      },
    },
    async (req, res) => {
      const { extension } = req.body;
      res.status(200).send({ extension });
    },
  );

  return app;
}
