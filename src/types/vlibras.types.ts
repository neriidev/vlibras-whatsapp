export interface TranslateResponse {
  gloss: string;
}

export interface VideoJobResponse {
  jobId: string;
  status: 'processing' | 'done' | 'failed';
  videoUrl?: string;
}
