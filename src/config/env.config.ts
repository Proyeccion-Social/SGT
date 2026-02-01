import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // Database Local
  LOCAL_DB_HOST: Joi.string().required(),
  LOCAL_DB_PORT: Joi.number().default(5432),
  LOCAL_DB_USER: Joi.string().required(),
  LOCAL_DB_PASSWORD: Joi.string().allow('').optional(),
  LOCAL_DB_NAME: Joi.string().required(),

  // Database Neon
  NEON_DATABASE_URL: Joi.string().uri().optional(),

  // App Config
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
});
