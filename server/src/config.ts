import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing required environment variable ${name}`);
  return v;
}

const nodeEnv = process.env.NODE_ENV ?? 'development';

export const config = {
  nodeEnv,
  isProd: nodeEnv === 'production',
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: required('JWT_SECRET', nodeEnv === 'production' ? undefined : 'dev-only-insecure-secret'),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  publicApiUrl: process.env.PUBLIC_API_URL ?? '',
  uploadDir: process.env.UPLOAD_DIR ?? 'uploads',
  maxUploadBytes: Number(process.env.MAX_UPLOAD_MB ?? 8) * 1024 * 1024,
  robotOnlineMinutes: Number(process.env.ROBOT_ONLINE_MINUTES ?? 10),
  surveyWindowDays: Number(process.env.SURVEY_WINDOW_DAYS ?? 30),
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM ?? 'Smart Farm <no-reply@smartfarm.local>',
  },
  ai: {
    diseaseProvider: (process.env.AI_DISEASE_PROVIDER ?? 'none').toLowerCase(),
    nutrientProvider: (process.env.AI_NUTRIENT_PROVIDER ?? 'none').toLowerCase(),
    kindwiseApiKey: process.env.KINDWISE_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    anthropicModel: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5',
    customModelUrl: process.env.CUSTOM_AI_URL,
    customModelToken: process.env.CUSTOM_AI_TOKEN,
  },
};
