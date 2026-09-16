import fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { webhookRoutes } from './routes/webhook.routes';
import { instanceRoutes } from './routes/instance.routes';

export function buildApp() {
  const app = fastify({
    logger: true
  });

  // CORS
  app.register(cors, {
    origin: '*' // Para produção, limite para os domínios permitidos
  });

  // Servir arquivos estáticos do frontend (React build)
  app.register(fastifyStatic, {
    root: path.join(__dirname, '..', 'public'), // Pasta public na raiz (dist do frontend será copiada para lá)
    prefix: '/',
  });

  // Registra as rotas
  app.register(webhookRoutes);
  app.register(instanceRoutes);

  // Rota de Healthcheck
  app.get('/health', async () => {
    return { status: 'up' };
  });

  // Sandbox para o Puppeteer (evita problemas de CORS/about:blank)
  app.get('/vlibras-sandbox', async (request, reply) => {
    reply.type('text/html').send(`
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { margin: 0; padding: 0; background-color: #00FF00; width: 640px; height: 480px; overflow: hidden; }
            iframe { border: none; width: 640px; height: 480px; }
          </style>
        </head>
        <body>
          <iframe id="unity-frame" src="https://vlibras.gov.br/app/unity/index.html"></iframe>
        </body>
        </html>
    `);
  });

  // Rota para fallback do SPA (React)
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api')) {
      reply.status(404).send({ error: 'Not found' });
    } else {
      reply.sendFile('index.html');
    }
  });

  return app;
}
