import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  databaseUrl: process.env.DATABASE_URL || './data/my_app.db',

  jwt: {
    secret: process.env.JWT_SECRET || 'changeme_use_a_long_random_string_in_production',
    expiration: process.env.JWT_EXPIRATION || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'changeme_refresh_secret',
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
  },

  mail: {
    host: process.env.MAIL_HOST || 'smtp.example.com',
    port: parseInt(process.env.MAIL_PORT || '587', 10),
    user: process.env.MAIL_USER || 'user@example.com',
    pass: process.env.MAIL_PASS || 'password',
    from: process.env.MAIL_FROM || 'no-reply@example.com',
  },

  upload: {
    destination: process.env.UPLOAD_DEST || './uploads',
    maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '5', 10),
    allowedFileTypes: process.env.ALLOWED_FILE_TYPES ? process.env.ALLOWED_FILE_TYPES.split(',') : ['image/jpeg', 'image/png', 'application/pdf'],
  },

  log: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || './logs',
  },

  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
}));
