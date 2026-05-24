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

  // AWS SES v2 via SQS — la Lambda consume la cola y envía los correos.
  // SQS_QUEUE_URL es obligatoria en producción; en desarrollo puede omitirse
  // (los emails se omitirán con un warning en el log).
  SQS_QUEUE_URL: Joi.string().uri().when('NODE_ENV', {
    is: 'production',
    then: Joi.string().uri().required(),
    otherwise: Joi.string().uri().optional(),
  }),
  AWS_REGION: Joi.string().default('us-east-1'),

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
