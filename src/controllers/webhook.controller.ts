import { FastifyRequest, FastifyReply } from 'fastify';
import { WebhookPayload } from '../types/evolution.types';
import { VLibrasService } from '../services/vlibras.service';
import { EvolutionService } from '../services/evolution.service';

const vlibrasService = new VLibrasService();
const evolutionService = new EvolutionService();

export class WebhookController {
  async handleEvolutionWebhook(request: FastifyRequest, reply: FastifyReply) {
    const payload = request.body as any;
    
    console.log('--- NOVO WEBHOOK RECEBIDO ---');
    console.log(JSON.stringify(payload, null, 2));

    // Verificar se é o evento correto de mensagem
    if (payload.event !== 'messages.upsert' && payload.event !== 'MESSAGES_UPSERT') {
      return reply.status(200).send({ message: 'Evento ignorado' });
    }

    // Compatibilidade com v1 e v2 da Evolution API
    const messageData = payload.data?.message ? payload.data : payload.data; 
    const key = messageData?.key || messageData?.message?.key;
    const remoteJid = key?.remoteJid;
    const isGroup = remoteJid?.includes('@g.us');
    const fromMe = key?.fromMe;
    
    const messageContent = messageData?.message || messageData;
    const textContent = messageContent?.conversation || messageContent?.extendedTextMessage?.text;

    if (!remoteJid) {
       return reply.status(200).send({ message: 'Sem JID' });
    }

    // Ignorar mensagens de grupos, enviadas por mim, ou vazias
    if (isGroup || fromMe || !textContent) {
      return reply.status(200).send({ message: 'Mensagem não elegível para processamento' });
    }

    // Processamento assíncrono para não bloquear o webhook
    this.processMessage(remoteJid, textContent).catch(console.error);

    return reply.status(200).send({ status: 'ok' });
  }

  private async processMessage(remoteJid: string, text: string) {
    try {
      // Geração real do Vídeo em Libras usando Puppeteer
      const videoPath = await vlibrasService.requestVideo(text);
      
      // Ler o MP4 gerado
      const fs = require('fs');
      const videoBuffer = fs.readFileSync(videoPath);
      const videoBase64 = videoBuffer.toString('base64');
      
      // Envio da Resposta com o vídeo Base64
      await evolutionService.sendVideo({
        number: remoteJid.replace('@s.whatsapp.net', ''),
        mediatype: 'video',
        mimetype: 'video/mp4',
        media: videoBase64,
        caption: 'Aqui está a tradução em Libras da sua mensagem.',
        fileName: 'vlibras.mp4'
      });
      
      // Limpeza
      if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
    } catch (error) {
      console.error(`Erro ao processar mensagem para ${remoteJid}:`, error);
      
      // Fallback
      await evolutionService.sendText(
        remoteJid, 
        'Desculpe, ocorreu um erro ao tentar traduzir sua mensagem para Libras.'
      ).catch(console.error);
    }
  }
}
