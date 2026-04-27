import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { FilterTutorsBySubjectsDto } from './filter-tutors-by-subjects.dto';
import { Modality } from '../enums/modality.enum';

describe('FilterTutorsBySubjectsDto', () => {
  const validUuid1 = '550e8400-e29b-41d4-a716-446655440000';
  const validUuid2 = '660e8400-e29b-41d4-a716-446655440001';
  const validUuid3 = '770e8400-e29b-41d4-a716-446655440002';
  const invalidUuid = 'not-a-uuid';

  describe('subjectIds transformation', () => {
    it('should handle single UUID as string and convert to array', async () => {
      const dto = plainToInstance(FilterTutorsBySubjectsDto, {
        subjectIds: validUuid1,
        page: 1,
        limit: 10,
      });

      expect(Array.isArray(dto.subjectIds)).toBe(true);
      expect(dto.subjectIds).toEqual([validUuid1]);
    });

    it('should handle array of UUIDs', async () => {
      const dto = plainToInstance(FilterTutorsBySubjectsDto, {
        subjectIds: [validUuid1, validUuid2],
        page: 1,
        limit: 10,
      });

      expect(Array.isArray(dto.subjectIds)).toBe(true);
      expect(dto.subjectIds).toEqual([validUuid1, validUuid2]);
    });

    it('should handle CSV format with comma-separated UUIDs', async () => {
      const dto = plainToInstance(FilterTutorsBySubjectsDto, {
        subjectIds: `${validUuid1},${validUuid2},${validUuid3}`,
        page: 1,
        limit: 10,
      });

      expect(Array.isArray(dto.subjectIds)).toBe(true);
      expect(dto.subjectIds).toEqual([validUuid1, validUuid2, validUuid3]);
    });

    it('should trim whitespace in CSV format', async () => {
      const dto = plainToInstance(FilterTutorsBySubjectsDto, {
        subjectIds: `${validUuid1} , ${validUuid2} , ${validUuid3}`,
        page: 1,
        limit: 10,
      });

      expect(Array.isArray(dto.subjectIds)).toBe(true);
      expect(dto.subjectIds).toEqual([validUuid1, validUuid2, validUuid3]);
    });
  });

  describe('validation', () => {
    it('should pass validation with valid UUIDs', async () => {
      const dto = plainToInstance(FilterTutorsBySubjectsDto, {
        subjectIds: [validUuid1, validUuid2],
        page: 1,
        limit: 10,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation if subjectIds contains invalid UUID', async () => {
      const dto = plainToInstance(FilterTutorsBySubjectsDto, {
        subjectIds: [validUuid1, invalidUuid],
        page: 1,
        limit: 10,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('subjectIds');
    });

    it('should fail validation if subjectIds is empty array', async () => {
      const dto = plainToInstance(FilterTutorsBySubjectsDto, {
        subjectIds: [],
        page: 1,
        limit: 10,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints?.['arrayMinSize']).toContain(
        'al menos un ID',
      );
    });

    it('should fail validation if subjectIds is not an array', async () => {
      const dto = plainToInstance(FilterTutorsBySubjectsDto, {
        subjectIds: 123, // Invalid: number instead of string/array
        page: 1,
        limit: 10,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('subjectIds');
    });
  });

  describe('optional filters', () => {
    it('should accept optional modality filter', async () => {
      const dto = plainToInstance(FilterTutorsBySubjectsDto, {
        subjectIds: [validUuid1],
        page: 1,
        limit: 10,
        modality: Modality.PRES,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.modality).toBe(Modality.PRES);
    });

    it('should accept onlyAvailable filter as string "true"', async () => {
      const dto = plainToInstance(FilterTutorsBySubjectsDto, {
        subjectIds: [validUuid1],
        page: 1,
        limit: 10,
        onlyAvailable: 'true',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.onlyAvailable).toBe(true);
    });

    it('should accept weekStart in ISO date format', async () => {
      const weekStart = '2024-01-08'; // Monday
      const dto = plainToInstance(FilterTutorsBySubjectsDto, {
        subjectIds: [validUuid1],
        page: 1,
        limit: 10,
        weekStart,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.weekStart).toBe(weekStart);
    });

    it('should fail validation if weekStart is not ISO date', async () => {
      const dto = plainToInstance(FilterTutorsBySubjectsDto, {
        subjectIds: [validUuid1],
        page: 1,
        limit: 10,
        weekStart: 'not-a-date',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('weekStart');
    });
  });

  describe('pagination defaults', () => {
    it('should inherit pagination fields from PaginationDto', async () => {
      const dto = plainToInstance(FilterTutorsBySubjectsDto, {
        subjectIds: [validUuid1],
        page: 5,
        limit: 20,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.page).toBe(5);
      expect(dto.limit).toBe(20);
    });
  });
});
