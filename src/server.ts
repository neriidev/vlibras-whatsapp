import { buildApp } from './app';
import { env } from './config/env';

const start = async () => {
  const app = buildApp();
  
  try {
    await app.listen({ port: parseInt(env.PORT, 10), host: '0.0.0.0' });
    app.log.info(`Servidor rodando na porta ${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
