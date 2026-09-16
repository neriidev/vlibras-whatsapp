import axios from 'axios';
import { env } from '../config/env';
import { SendMediaPayload } from '../types/evolution.types';

export class EvolutionService {
  private api = axios.create({
    baseURL: env.EVOLUTION_API_URL,
    headers: {
      apikey: env.EVOLUTION_API_KEY,
      'Content-Type': 'application/json'
    }
  });

  async sendVideo(payload: SendMediaPayload): Promise<void> {
    try {
      await this.api.post(`/message/sendMedia/${env.INSTANCE_NAME}`, payload);
    } catch (error) {
      console.error('Erro ao enviar vídeo pela Evolution API:', error);
      throw error;
    }
  }
  
  async sendText(number: string, text: string): Promise<void> {
    try {
      await this.api.post(`/message/sendText/${env.INSTANCE_NAME}`, {
        number,
        text // Evolution v2 payload properties
      });
    } catch (error) {
      console.error('Erro ao enviar texto pela Evolution API:', error);
      throw error;
    }
  }

  async getConnectionState(): Promise<{ state: string }> {
    try {
      const response = await this.api.get(`/instance/connectionState/${env.INSTANCE_NAME}`);
      return response.data.instance;
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        return { state: 'not_found' };
      }
      throw error;
    }
  }

  async createInstance(): Promise<{ qrcode?: { base64: string } }> {
    try {
      const response = await this.api.post('/instance/create', {
        instanceName: env.INSTANCE_NAME,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS'
      });
      
      // Configurar o webhook logo após criar a instância
      await this.setWebhook();
      
      return response.data;
    } catch (error) {
      console.error('Erro ao criar instância:', error);
      throw error;
    }
  }

  async getQrCode(): Promise<{ base64: string }> {
    try {
      const response = await this.api.get(`/instance/connect/${env.INSTANCE_NAME}`);
      return response.data;
    } catch (error) {
      console.error('Erro ao obter QR Code:', error);
      throw error;
    }
  }

  async setWebhook(): Promise<void> {
    try {
      // Usar a URL base de onde a aplicação estiver rodando ou uma variável. 
      // Por padrão configuramos de forma que o usuário precisará preencher uma env se estiver num tunel.
      // Para localhost podemos usar ngrok url ou simplesmente setar a rota
      // Se não houver WEBHOOK_URL configurada no .env, não seta
      if (process.env.WEBHOOK_URL) {
        await this.api.post(`/webhook/set/${env.INSTANCE_NAME}`, {
          webhook: {
            enabled: true,
            url: `${process.env.WEBHOOK_URL}/webhook/evolution`,
            byEvents: false,
            base64: false,
            events: ['MESSAGES_UPSERT']
          }
        });
        console.log('Webhook configurado com sucesso na Evolution API.');
      }
    } catch (error) {
      console.error('Erro ao configurar webhook:', error);
    }
  }
}
