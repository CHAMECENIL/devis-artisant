import { registerAs } from '@nestjs/config';

export interface StorageConfig {
  region: string;
  bucket: string;
  endpoint: string | undefined;
  accessKeyId: string;
  secretAccessKey: string;
}

export default registerAs(
  'storage',
  (): StorageConfig => ({
    region: process.env.AWS_REGION || 'eu-west-3',
    bucket: process.env.S3_BUCKET || 'saas-devis-artisan',
    endpoint: process.env.S3_ENDPOINT || undefined,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  }),
);
