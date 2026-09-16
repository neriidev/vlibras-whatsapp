import axios from 'axios';
import { RendererService } from './renderer.service';

export class VLibrasService {
  private renderer: RendererService;

  constructor() {
    this.renderer = new RendererService();
  }

  async requestVideo(text: string): Promise<string> {
    try {
      console.log(`[VLibras] Solicitando renderização real de vídeo para: "${text}"`);
      
      // Chama o renderizador que grava o WebGL via Puppeteer
      const mp4Path = await this.renderer.renderVideo(text);
      
      return mp4Path;
    } catch (error) {
      console.error('Erro na geração de vídeo VLibras:', error);
      throw new Error('Falha ao gerar o vídeo em Libras');
    }
  }
}
