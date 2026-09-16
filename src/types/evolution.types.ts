export interface WebhookPayload {
  event: string;
  instance: string;
  data: {
    message: {
      key: {
        remoteJid: string;
        fromMe: boolean;
        id: string;
      };
      message?: {
        conversation?: string;
        extendedTextMessage?: {
          text?: string;
        };
      };
      messageType?: string;
    };
  };
}

export interface SendMediaPayload {
  number: string;
  mediatype: 'video';
  mimetype: string;
  media: string; // base64 puro (sem prefixo data:)
  caption: string;
  fileName: string;
}
