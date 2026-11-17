import closeWithGrace from 'close-with-grace';
import { buildApp } from './app.ts';
const app = await buildApp();

closeWithGrace({ delay: 5_000 }, async ({ signal, err }) => {
  if (err) {
    app.log.error(err, 'server closing due to error');
  } else {
    app.log.info(`${signal} received, shutting down`);
  }
  app.server.close();
  app.server.closeAllConnections();
  await app.close();
});

try {
  await app.listen({ port: 3000, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
