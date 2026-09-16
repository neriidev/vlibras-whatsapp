import { FastifyInstance } from 'fastify';
import { WebhookController } from '../controllers/webhook.controller';

const webhookController = new WebhookController();

export async function webhookRoutes(fastify: FastifyInstance) {
  fastify.post('/webhook/evolution', webhookController.handleEvolutionWebhook.bind(webhookController));
}
