import puppeteer, { Browser, Page } from 'puppeteer';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export class RendererService {
  private browser: Browser | null = null;
  private readonly tempDir: string;

  constructor() {
    this.tempDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async init() {
    if (!this.browser) {
      console.log('[Renderer] Inicializando Chromium/Puppeteer...');
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--use-gl=angle',
          '--use-angle=swiftshader',
          '--enable-webgl',
          '--enable-unsafe-swiftshader',
          '--ignore-certificate-errors',
          '--disable-gpu-sandbox',
          '--window-size=640,480',
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      });
      console.log('[Renderer] Chromium iniciado com sucesso.');
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async renderVideo(text: string): Promise<string> {
    await this.init();
    if (!this.browser) throw new Error('Browser não inicializado');

    const page = await this.browser.newPage();
    
    // Capturar logs do navegador para debug
    page.on('console', msg => console.log('[Browser Log]', msg.text()));
    page.on('pageerror', (err: any) => console.log('[Browser Error]', err.toString()));

    const jobId = crypto.randomBytes(8).toString('hex');
    const framesDir = path.join(this.tempDir, `frames_${jobId}`);
    const mp4Path = path.join(this.tempDir, `${jobId}.mp4`);

    fs.mkdirSync(framesDir, { recursive: true });

    try {
      console.log(`[Renderer] Preparando página para renderizar: "${text}"`);

      // 1. Traduzir o texto para gloss via API oficial
      console.log('[Renderer] Traduzindo texto para gloss...');
      const glossResponse = await fetch('https://traducao2.vlibras.gov.br/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      
      if (!glossResponse.ok) {
        throw new Error(`Erro na tradução: ${glossResponse.status}`);
      }
      
      const glossText = await glossResponse.text();
      let gloss: string;
      try {
        const parsed = JSON.parse(glossText);
        gloss = parsed.traducao || glossText;
      } catch {
        gloss = glossText.trim();
      }
      console.log(`[Renderer] Gloss obtido: "${gloss}"`);

      // 2. Carregar o Unity player DIRETAMENTE (sem o widget wrapper que bloqueia WebGL)
      await page.setViewport({ width: 640, height: 480 });
      
      console.log('[Renderer] Carregando Unity player diretamente...');
      await page.goto('https://vlibras.gov.br/app/unity/index.html?v=7.12.2', { 
        waitUntil: 'domcontentloaded', 
        timeout: 30000 
      });

      // 3. Aguardar o Unity carregar completamente (avatar 3D visível)
      console.log('[Renderer] Aguardando Unity carregar o avatar 3D...');
      
      let unityReady = false;
      for (let attempt = 0; attempt < 60; attempt++) {
        await new Promise(r => setTimeout(r, 2000));
        
        const status = await page.evaluate(() => {
          const canvas = document.querySelector('canvas');
          if (!canvas || canvas.width <= 300) return false;
          
          // Verificar se getUnityInstance retorna algo válido
          if (typeof (window as any).getUnityInstance === 'function') {
            const instance = (window as any).getUnityInstance();
            if (instance) return true;
          }
          
          // Verificar se o gameInstance existe
          if ((window as any).gameInstance) return true;
          
          return false;
        }).catch(() => false);
        
        if (status) {
          unityReady = true;
          console.log(`[Renderer] Avatar Unity carregado após ${(attempt + 1) * 2}s!`);
          break;
        }
        
        if (attempt % 5 === 0) {
          console.log(`[Renderer] Ainda carregando Unity... ${(attempt + 1) * 2}s`);
        }
      }
      
      if (!unityReady) {
        // Tirar screenshot de debug
        const debugPath = path.join(this.tempDir, `debug_unity_${jobId}.png`);
        await page.screenshot({ path: debugPath }).catch(() => {});
        console.log(`[Renderer] Screenshot debug: ${debugPath}`);
        
        // Verificar se pelo menos o canvas está renderizando (pode funcionar sem gameInstance)
        const canvasReady = await page.evaluate(() => {
          const canvas = document.querySelector('canvas');
          return canvas && canvas.width >= 640;
        }).catch(() => false);
        
        if (!canvasReady) {
          throw new Error('Unity não carregou após 120s');
        }
        console.log('[Renderer] Canvas encontrado, continuando sem gameInstance...');
      }

      // Esperar a welcome animation terminar
      console.log('[Renderer] Aguardando welcome animation...');
      await new Promise(r => setTimeout(r, 5000));

      // 4. Enviar o gloss para o player
      console.log(`[Renderer] Enviando gloss para o player: "${gloss}"`);
      await page.evaluate((g: string) => {
        // Método 1: via postMessage
        window.postMessage({ 
          type: "unity", 
          object: "PlayerManager", 
          method: "playNow", 
          params: g 
        }, "*");
        
        // Método 2: direto via Unity instance se disponível
        if (typeof (window as any).getUnityInstance === 'function') {
          const instance = (window as any).getUnityInstance();
          if (instance && instance.SendMessage) {
            instance.SendMessage('PlayerManager', 'playNow', g);
          }
        }
      }, gloss);

      // 5. Aguardar a animação iniciar
      console.log('[Renderer] Aguardando animação de Libras iniciar...');
      await new Promise(r => setTimeout(r, 3000));

      // 7. Capturar frames via screenshots sequenciais
      console.log('[Renderer] Iniciando captura de frames (screenshot mode)...');
      
      let frameCount = 0;
      const capturedFrames: string[] = [];
      const captureStartTime = Date.now();
      const captureDuration = 10000; // 10 segundos
      const frameInterval = 100; // ~10fps

      console.log(`[Renderer] Gravando por ${captureDuration / 1000} segundos (~${1000/frameInterval}fps)...`);
      
      while (Date.now() - captureStartTime < captureDuration) {
        const framePath = path.join(framesDir, `frame_${String(frameCount).padStart(5, '0')}.png`);
        try {
          await page.screenshot({ path: framePath, type: 'png' });
          capturedFrames.push(framePath);
          frameCount++;
        } catch (e) {
          // Ignorar falhas individuais de screenshot
        }
        
        // Esperar para manter o FPS desejado
        const elapsed = Date.now() - captureStartTime;
        const expectedFrame = Math.floor(elapsed / frameInterval);
        if (frameCount > expectedFrame) {
          await new Promise(r => setTimeout(r, frameInterval - (elapsed % frameInterval)));
        }
      }

      console.log(`[Renderer] ${frameCount} frames capturados.`);

      if (frameCount === 0) {
        throw new Error('Nenhum frame capturado');
      }

      // 7. Converter frames para MP4 com FFmpeg
      console.log('[Renderer] Convertendo frames para MP4...');
      
      // Calcular FPS real baseado nos frames capturados (~60fps do screencast)
      const actualDuration = (Date.now() - captureStartTime) / 1000;
      const realFps = Math.max(10, Math.round(frameCount / actualDuration));
      console.log(`[Renderer] FPS calculado: ${realFps}`);
      
      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(path.join(framesDir, 'frame_%05d.png'))
          .inputFPS(realFps)
          .outputOptions('-c:v', 'libx264')
          .outputOptions('-preset', 'fast')
          .outputOptions('-pix_fmt', 'yuv420p')
          .outputOptions('-vf', 'scale=640:480')
          .outputOptions('-r', '30') // output a 30fps para ficar suave
          .save(mp4Path)
          .on('end', () => resolve())
          .on('error', (err) => reject(err));
      });

      console.log('[Renderer] Renderização concluída:', mp4Path);
      return mp4Path;
    } catch (error) {
      console.error('[Renderer] Erro ao renderizar vídeo:', error);
      throw error;
    } finally {
      await page.close().catch(() => {});
      // Limpar frames
      if (fs.existsSync(framesDir)) {
        const files = fs.readdirSync(framesDir);
        files.forEach(f => fs.unlinkSync(path.join(framesDir, f)));
        fs.rmdirSync(framesDir);
      }
    }
  }
}
