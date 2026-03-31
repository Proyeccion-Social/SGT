import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import supertest from 'supertest';
import { App } from 'supertest/types';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { SessionExecutionController } from './controllers/session-execution.controller';
import { SessionExecutionService } from './services/session-execution.service';
import type { TutorStatsResponse } from './services/session-execution.service';
import { JwtStrategy } from './guards/jwt.strategy';
import { RolesGuard } from './guards/roles.guard';

const JWT_SECRET = 'default_secret';

function signToken(payload: object): string {
  const jwtService = new JwtService({ secret: JWT_SECRET });
  return jwtService.sign(payload);
}

const VALID_TUTOR_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

describe('SessionExecutionController - GET /api/v1/session-execution/tutors/:tutorId/stats', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.env.JWT_SECRET = JWT_SECRET;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
          secret: JWT_SECRET,
          signOptions: { expiresIn: '1d' },
        }),
      ],
      controllers: [SessionExecutionController],
      providers: [SessionExecutionService, JwtStrategy, RolesGuard],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        errorHttpStatusCode: HttpStatus.BAD_REQUEST,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authorization header validation', () => {
    it('should return 401 when Authorization header is missing', async () => {
      const response = await supertest(app.getHttpServer())
        .get(`/api/v1/session-execution/tutors/${VALID_TUTOR_ID}/stats`)
        .expect(HttpStatus.UNAUTHORIZED);

      expect(response.body).toBeDefined();
    });

    it('should return 401 when token is invalid', async () => {
      const response = await supertest(app.getHttpServer())
        .get(`/api/v1/session-execution/tutors/${VALID_TUTOR_ID}/stats`)
        .set('Authorization', 'Bearer invalid_token')
        .expect(HttpStatus.UNAUTHORIZED);

      expect(response.body).toBeDefined();
    });
  });

  describe('tutorId param validation', () => {
    it('should return 400 when tutorId is not a valid UUID', async () => {
      const adminToken = signToken({ sub: 'admin-id', role: 'ADMIN' });

      const response = await supertest(app.getHttpServer())
        .get('/api/v1/session-execution/tutors/not-a-uuid/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body).toBeDefined();
    });

    it('should accept a valid UUID as tutorId', async () => {
      const adminToken = signToken({ sub: 'admin-id', role: 'ADMIN' });

      await supertest(app.getHttpServer())
        .get(`/api/v1/session-execution/tutors/${VALID_TUTOR_ID}/stats`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);
    });
  });

  describe('Role-based access control', () => {
    it('should return 403 when user has STUDENT role', async () => {
      const studentToken = signToken({ sub: 'student-id', role: 'STUDENT' });

      const response = await supertest(app.getHttpServer())
        .get(`/api/v1/session-execution/tutors/${VALID_TUTOR_ID}/stats`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(HttpStatus.FORBIDDEN);

      const errorBody = response.body as { message: string };
      expect(errorBody.message).toContain('tutores y administradores');
    });

    it('should allow ADMIN to access any tutor stats', async () => {
      const adminToken = signToken({ sub: 'admin-id', role: 'ADMIN' });

      await supertest(app.getHttpServer())
        .get(`/api/v1/session-execution/tutors/${VALID_TUTOR_ID}/stats`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);
    });

    it('should allow TUTOR to access their own stats (matching sub)', async () => {
      const tutorToken = signToken({ sub: VALID_TUTOR_ID, role: 'TUTOR' });

      await supertest(app.getHttpServer())
        .get(`/api/v1/session-execution/tutors/${VALID_TUTOR_ID}/stats`)
        .set('Authorization', `Bearer ${tutorToken}`)
        .expect(HttpStatus.OK);
    });

    it('should allow TUTOR to access their own stats (matching tutorId claim)', async () => {
      const tutorToken = signToken({
        sub: 'some-user-id',
        role: 'TUTOR',
        tutorId: VALID_TUTOR_ID,
      });

      await supertest(app.getHttpServer())
        .get(`/api/v1/session-execution/tutors/${VALID_TUTOR_ID}/stats`)
        .set('Authorization', `Bearer ${tutorToken}`)
        .expect(HttpStatus.OK);
    });

    it('should return 403 when TUTOR tries to access another tutor stats', async () => {
      const otherTutorId = 'bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb';
      const tutorToken = signToken({
        sub: 'cccccccc-cccc-4ccc-accc-cccccccccccc',
        role: 'TUTOR',
        tutorId: 'cccccccc-cccc-4ccc-accc-cccccccccccc',
      });

      const response = await supertest(app.getHttpServer())
        .get(`/api/v1/session-execution/tutors/${otherTutorId}/stats`)
        .set('Authorization', `Bearer ${tutorToken}`)
        .expect(HttpStatus.FORBIDDEN);

      const errorBody = response.body as { message: string };
      expect(errorBody.message).toContain('propias métricas');
    });
  });

  describe('Query parameter validation', () => {
    it('should return 400 when startDate has invalid format', async () => {
      const adminToken = signToken({ sub: 'admin-id', role: 'ADMIN' });

      const response = await supertest(app.getHttpServer())
        .get(
          `/api/v1/session-execution/tutors/${VALID_TUTOR_ID}/stats?startDate=31-01-2025`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body).toBeDefined();
    });

    it('should return 400 when endDate has invalid format', async () => {
      const adminToken = signToken({ sub: 'admin-id', role: 'ADMIN' });

      const response = await supertest(app.getHttpServer())
        .get(
          `/api/v1/session-execution/tutors/${VALID_TUTOR_ID}/stats?endDate=2025/01/31`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body).toBeDefined();
    });

    it('should return 400 when subjectId is not a valid UUID', async () => {
      const adminToken = signToken({ sub: 'admin-id', role: 'ADMIN' });

      const response = await supertest(app.getHttpServer())
        .get(
          `/api/v1/session-execution/tutors/${VALID_TUTOR_ID}/stats?subjectId=not-a-uuid`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body).toBeDefined();
    });

    it('should return 400 when startDate is after endDate', async () => {
      const adminToken = signToken({ sub: 'admin-id', role: 'ADMIN' });

      const response = await supertest(app.getHttpServer())
        .get(
          `/api/v1/session-execution/tutors/${VALID_TUTOR_ID}/stats?startDate=2025-06-01&endDate=2025-01-01`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.BAD_REQUEST);

      const errorBody = response.body as { message: string };
      expect(errorBody.message).toContain('fechas inválido');
    });

    it('should accept valid date range', async () => {
      const adminToken = signToken({ sub: 'admin-id', role: 'ADMIN' });

      await supertest(app.getHttpServer())
        .get(
          `/api/v1/session-execution/tutors/${VALID_TUTOR_ID}/stats?startDate=2025-01-01&endDate=2025-06-01`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);
    });

    it('should accept valid subjectId UUID', async () => {
      const adminToken = signToken({ sub: 'admin-id', role: 'ADMIN' });
      const subjectId = 'dddddddd-dddd-4ddd-addd-dddddddddddd';

      await supertest(app.getHttpServer())
        .get(
          `/api/v1/session-execution/tutors/${VALID_TUTOR_ID}/stats?subjectId=${subjectId}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);
    });

    it('should work with no query params (returns all historical metrics)', async () => {
      const adminToken = signToken({ sub: 'admin-id', role: 'ADMIN' });

      const response = await supertest(app.getHttpServer())
        .get(`/api/v1/session-execution/tutors/${VALID_TUTOR_ID}/stats`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);

      const body = response.body as TutorStatsResponse;
      expect(body.period.description).toBe('Todas las métricas históricas');
    });
  });

  describe('Successful response structure', () => {
    it('should return the correct response body structure on success', async () => {
      const adminToken = signToken({ sub: 'admin-id', role: 'ADMIN' });

      const response = await supertest(app.getHttpServer())
        .get(`/api/v1/session-execution/tutors/${VALID_TUTOR_ID}/stats`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);

      const body = response.body as TutorStatsResponse;
      expect(body.tutorId).toBe(VALID_TUTOR_ID);
      expect(body.tutorName).toBeDefined();
      expect(body.period).toBeDefined();
      expect(body.ratingMetrics).toBeDefined();
      expect(body.ratingMetrics.averageOverall).toBeDefined();
      expect(body.ratingMetrics.averageByAspect).toBeDefined();
      expect(body.ratingMetrics.ratingDistribution).toBeDefined();
      expect(body.sessionMetrics).toBeDefined();
      expect(body.attendanceMetrics).toBeDefined();
      expect(body.temporalMetrics).toBeDefined();
      expect(body.calculatedAt).toBeDefined();
    });
  });
});
