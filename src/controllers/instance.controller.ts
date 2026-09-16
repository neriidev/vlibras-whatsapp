import { FastifyRequest, FastifyReply } from 'fastify';
import { EvolutionService } from '../services/evolution.service';

const evolutionService = new EvolutionService();

export class InstanceController {
  async getQrCode(request: FastifyRequest, reply: FastifyReply) {
    try {
      // 1. Verificar status da instância
      const connection = await evolutionService.getConnectionState();

      if (connection.state === 'not_found') {
        // Criar a instância
        const instanceData = await evolutionService.createInstance();
        if (instanceData.qrcode && instanceData.qrcode.base64) {
          return reply.send({ status: 'qrcode', base64: instanceData.qrcode.base64 });
        }
      }

      if (connection.state === 'open') {
        return reply.send({ status: 'connected' });
      }

      // Se já existe mas não está conectada, busca o QR code
      const qrCodeData = await evolutionService.getQrCode();
      if (qrCodeData.base64) {
        return reply.send({ status: 'qrcode', base64: qrCodeData.base64 });
      }

      return reply.status(400).send({ error: 'Não foi possível obter o QR Code', details: connection });
    } catch (error) {
      console.error('Erro ao gerenciar instância:', error);
      return reply.status(500).send({ error: 'Erro interno ao processar a instância' });
    }
  }
}
