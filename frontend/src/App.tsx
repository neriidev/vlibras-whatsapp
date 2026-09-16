import { useState, useEffect } from 'react';
import axios from 'axios';
import { Smartphone, CheckCircle2, AlertCircle } from 'lucide-react';
import './App.css';

function App() {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'qrcode' | 'connected' | 'error'>('loading');

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;

    const fetchInstance = async () => {
      try {
        // Usa a rota relativa /api/instance/qrcode porque o frontend será servido pelo backend
        const response = await axios.get('/api/instance/qrcode');
        
        if (response.data.status === 'connected') {
          setStatus('connected');
          setQrCode(null);
          // Se conectou, para o polling
          if (intervalId) clearInterval(intervalId);
        } else if (response.data.status === 'qrcode' && response.data.base64) {
          setStatus('qrcode');
          setQrCode(response.data.base64);
        } else {
          setStatus('error');
        }
      } catch (error) {
        console.error('Erro ao buscar QR Code:', error);
        setStatus('error');
      }
    };

    // Busca inicialmente
    fetchInstance();

    // Polling a cada 5 segundos enquanto não estiver conectado
    intervalId = setInterval(() => {
      if (status !== 'connected') {
        fetchInstance();
      }
    }, 5000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [status]);

  return (
    <div className="container">
      <div className="glass-card">
        
        <div className="header">
          <Smartphone size={48} color="#10a37f" style={{ marginBottom: '1rem' }} />
          <h1 className="title">Conecte o seu Bot</h1>
          <p className="subtitle">Escaneie o QR Code com o WhatsApp para habilitar o serviço VLibras.</p>
        </div>

        <div className="qrcode-container">
          {status === 'loading' && (
            <div className="skeleton"></div>
          )}
          {status === 'qrcode' && qrCode && (
            <img 
              src={qrCode} 
              alt="QR Code WhatsApp" 
              className="qrcode-image"
            />
          )}
          {status === 'connected' && (
            <div className="qrcode-image" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
               <CheckCircle2 size={80} color="#34d399" />
            </div>
          )}
          {status === 'error' && (
            <div className="qrcode-image" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fef2f2' }}>
               <AlertCircle size={60} color="#f87171" />
            </div>
          )}
        </div>

        <div>
          {status === 'loading' && (
            <div className="status-badge loading">
              <div className="spinner"></div>
              Gerando QR Code...
            </div>
          )}
          
          {status === 'qrcode' && (
            <div className="status-badge loading">
              <div className="spinner"></div>
              Aguardando leitura...
            </div>
          )}

          {status === 'connected' && (
            <div className="status-badge connected">
              <div className="pulse"></div>
              Conectado com sucesso!
            </div>
          )}

          {status === 'error' && (
            <div className="status-badge error">
              <AlertCircle size={16} />
              Erro de conexão. Tentando novamente...
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default App;
