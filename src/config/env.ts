import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3000'),
  EVOLUTION_API_URL: z.string().url(),
  EVOLUTION_API_KEY: z.string(),
  INSTANCE_NAME: z.string(),
  VLIBRAS_ENDPOINT: z.string().url(),
});

export const env = envSchema.parse(process.env);
