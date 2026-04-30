import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // App Config
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  PORT: Joi.number().default(3000),

  // Database Local
  LOCAL_DB_HOST: Joi.string().when('NODE_ENV', {
    is: Joi.valid('production', 'test'),
    then: Joi.string().optional(),
    otherwise: Joi.string().required(),
  }),
  LOCAL_DB_PORT: Joi.number().when('NODE_ENV', {
    is: Joi.valid('production', 'test'),
    then: Joi.number().default(5432),
    otherwise: Joi.number().default(5432),
  }),
  LOCAL_DB_USER: Joi.string().when('NODE_ENV', {
    is: Joi.valid('production', 'test'),
    then: Joi.string().optional(),
    otherwise: Joi.string().required(),
  }),
  LOCAL_DB_PASSWORD: Joi.string().allow('').optional(),
  LOCAL_DB_NAME: Joi.string().when('NODE_ENV', {
    is: Joi.valid('production', 'test'),
    then: Joi.string().optional(),
    otherwise: Joi.string().required(),
  }),

  // Database Neon
  NEON_DATABASE_URL: Joi.string()
    .uri()
    .when('NODE_ENV', {
      is: Joi.valid('production', 'test'),
      then: Joi.string().uri().required(),
      otherwise: Joi.string().uri().optional(),
    }),

  //Resend — optional outside production; Vercel preview deployments can run
  // without email credentials (features that send email will silently fail).
  RESEND_API_KEY: Joi.string().default('dummy-resend-key'),
  RESEND_FROM_EMAIL: Joi.string().email().default('dev@noreply.local'),

  // JWT Config
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  // Cloudinary Config
  CLOUDINARY_NAME: Joi.string().when('NODE_ENV', {
    is: Joi.valid('production'),
    then: Joi.string().required(),
    otherwise: Joi.string().optional(),
  }),
  CLOUDINARY_API_KEY: Joi.string().when('NODE_ENV', {
    is: Joi.valid('production'),
    then: Joi.string().required(),
    otherwise: Joi.string().optional(),
  }),
  CLOUDINARY_API_SECRET: Joi.string().when('NODE_ENV', {
    is: Joi.valid('production'),
    then: Joi.string().required(),
    otherwise: Joi.string().optional(),
  }),
});
