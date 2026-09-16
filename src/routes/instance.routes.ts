import { FastifyInstance } from 'fastify';
import { InstanceController } from '../controllers/instance.controller';

const instanceController = new InstanceController();

export async function instanceRoutes(fastify: FastifyInstance) {
  fastify.get('/api/instance/qrcode', instanceController.getQrCode.bind(instanceController));
}
