import { HttpStatus } from '@nestjs/common';
import { StudentsController } from './student.controller';
import { UserRole } from '../../users/entities/user.entity';
import { PreferredModality } from '../entities/student.entity';

describe('StudentsController', () => {
  let controller: StudentsController;
  let studentService: any;

  beforeEach(() => {
    studentService = {
      getPreferences: jest.fn(),
      updatePreferences: jest.fn(),
      getInterestedSubjects: jest.fn(),
      updateInterestedSubjects: jest.fn(),
      getPreferencesById: jest.fn(),
      getInterestedSubjectsById: jest.fn(),
    };

    controller = new StudentsController(studentService);
  });

  // ─── getPreferences ───────────────────────────────────────────────────────────

  describe('getPreferences', () => {
    it('calls service with authenticated user ID', async () => {
      const user = { idUser: 'user-1', role: UserRole.STUDENT } as any;
      const mockPreferences = {
        career: 'Physics',
        preferredModality: PreferredModality.VIRT,
      };

      studentService.getPreferences.mockResolvedValue(mockPreferences);

      const result = await controller.getPreferences(user);

      expect(studentService.getPreferences).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockPreferences);
    });

    it('returns null preferences when not set', async () => {
      const user = { idUser: 'user-1', role: UserRole.STUDENT } as any;
      const mockPreferences = {
        career: null,
        preferredModality: null,
      };

      studentService.getPreferences.mockResolvedValue(mockPreferences);

      const result = await controller.getPreferences(user);

      expect(result).toEqual(mockPreferences);
    });
  });

  // ─── updatePreferences ────────────────────────────────────────────────────────

  describe('updatePreferences', () => {
    it('updates preferences and returns success message', async () => {
      const user = { idUser: 'user-1', role: UserRole.STUDENT } as any;
      const dto = {
        career: 'Mathematics',
        preferredModality: PreferredModality.PRES,
      };
      const mockResponse = {
        message: 'Preferencias actualizadas exitosamente',
      };

      studentService.updatePreferences.mockResolvedValue(mockResponse);

      const result = await controller.updatePreferences(user, dto);

      expect(studentService.updatePreferences).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
      expect(result.message).toContain('exitosamente');
    });

    it('handles partial updates', async () => {
      const user = { idUser: 'user-1', role: UserRole.STUDENT } as any;
      const dto = { career: 'Biology' };

      studentService.updatePreferences.mockResolvedValue({
        message: 'Preferencias actualizadas exitosamente',
      });

      await controller.updatePreferences(user, dto);

      expect(studentService.updatePreferences).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
    });
  });

  // ─── getInterestedSubjects ─────────────────────────────────────────────────────

  describe('getInterestedSubjects', () => {
    it('returns list of interested subjects for authenticated user', async () => {
      const user = { idUser: 'user-1', role: UserRole.STUDENT } as any;
      const mockSubjects = {
        subjects: [
          { id: 'subject-1', name: 'Math I' },
          { id: 'subject-2', name: 'Physics I' },
        ],
      };

      studentService.getInterestedSubjects.mockResolvedValue(mockSubjects);

      const result = await controller.getInterestedSubjects(user);

      expect(studentService.getInterestedSubjects).toHaveBeenCalledWith(
        'user-1',
      );
      expect(result.subjects).toHaveLength(2);
    });

    it('returns empty array when no subjects are selected', async () => {
      const user = { idUser: 'user-1', role: UserRole.STUDENT } as any;
      const mockSubjects = { subjects: [] };

      studentService.getInterestedSubjects.mockResolvedValue(mockSubjects);

      const result = await controller.getInterestedSubjects(user);

      expect(result.subjects).toHaveLength(0);
    });
  });

  // ─── updateInterestedSubjects ──────────────────────────────────────────────────

  describe('updateInterestedSubjects', () => {
    it('updates interested subjects and returns success message', async () => {
      const user = { idUser: 'user-1', role: UserRole.STUDENT } as any;
      const dto = {
        subjectIds: ['subject-1', 'subject-2', 'subject-3'],
      };
      const mockResponse = {
        message: 'Materias de interés actualizadas exitosamente',
      };

      studentService.updateInterestedSubjects.mockResolvedValue(mockResponse);

      const result = await controller.updateInterestedSubjects(user, dto);

      expect(studentService.updateInterestedSubjects).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
      expect(result.message).toContain('exitosamente');
    });

    it('allows clearing subjects with empty array', async () => {
      const user = { idUser: 'user-1', role: UserRole.STUDENT } as any;
      const dto = { subjectIds: [] };

      studentService.updateInterestedSubjects.mockResolvedValue({
        message: 'Materias de interés actualizadas exitosamente',
      });

      await controller.updateInterestedSubjects(user, dto);

      expect(studentService.updateInterestedSubjects).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
    });
  });

  // ─── getPreferencesById ────────────────────────────────────────────────────────

  describe('getPreferencesById', () => {
    it('returns preferences for specified student ID (ADMIN/TUTOR)', async () => {
      const studentId = '123e4567-e89b-12d3-a456-426614174000';
      const mockPreferences = {
        career: 'Computer Science',
        preferredModality: PreferredModality.VIRT,
      };

      studentService.getPreferencesById.mockResolvedValue(mockPreferences);

      const result = await controller.getPreferencesById(studentId);

      expect(studentService.getPreferencesById).toHaveBeenCalledWith(studentId);
      expect(result).toEqual(mockPreferences);
    });

    it('returns null preferences when student has not set them', async () => {
      const studentId = '123e4567-e89b-12d3-a456-426614174000';
      const mockPreferences = {
        career: null,
        preferredModality: null,
      };

      studentService.getPreferencesById.mockResolvedValue(mockPreferences);

      const result = await controller.getPreferencesById(studentId);

      expect(result).toEqual(mockPreferences);
    });

    it('handles service errors gracefully', async () => {
      const studentId = '123e4567-e89b-12d3-a456-426614174000';

      studentService.getPreferencesById.mockRejectedValue(
        new Error('Estudiante no encontrado'),
      );

      await expect(controller.getPreferencesById(studentId)).rejects.toThrow(
        'Estudiante no encontrado',
      );
    });
  });

  // ─── getInterestedSubjectsById ─────────────────────────────────────────────────

  describe('getInterestedSubjectsById', () => {
    it('returns interested subjects for specified student ID (ADMIN/TUTOR)', async () => {
      const studentId = '123e4567-e89b-12d3-a456-426614174000';
      const mockSubjects = {
        subjects: [
          { id: 'subject-1', name: 'Math I' },
          { id: 'subject-2', name: 'Chemistry I' },
          { id: 'subject-3', name: 'Biology I' },
        ],
      };

      studentService.getInterestedSubjectsById.mockResolvedValue(mockSubjects);

      const result = await controller.getInterestedSubjectsById(studentId);

      expect(studentService.getInterestedSubjectsById).toHaveBeenCalledWith(
        studentId,
      );
      expect(result.subjects).toHaveLength(3);
    });

    it('returns empty array when student has no interested subjects', async () => {
      const studentId = '123e4567-e89b-12d3-a456-426614174000';
      const mockSubjects = { subjects: [] };

      studentService.getInterestedSubjectsById.mockResolvedValue(mockSubjects);

      const result = await controller.getInterestedSubjectsById(studentId);

      expect(result.subjects).toHaveLength(0);
    });

    it('handles service errors gracefully', async () => {
      const studentId = '123e4567-e89b-12d3-a456-426614174000';

      studentService.getInterestedSubjectsById.mockRejectedValue(
        new Error('Estudiante no encontrado'),
      );

      await expect(
        controller.getInterestedSubjectsById(studentId),
      ).rejects.toThrow('Estudiante no encontrado');
    });
  });

  // ─── Integration tests (verifying endpoint flows) ─────────────────────────────

  describe('Integration - Full preference management flow', () => {
    it('handles complete CRUD flow for preferences', async () => {
      const user = { idUser: 'user-1', role: UserRole.STUDENT } as any;

      // 1. Get initial preferences (empty)
      studentService.getPreferences.mockResolvedValueOnce({
        career: null,
        preferredModality: null,
      });

      const initial = await controller.getPreferences(user);
      expect(initial.career).toBeNull();

      // 2. Update preferences
      studentService.updatePreferences.mockResolvedValueOnce({
        message: 'Preferencias actualizadas exitosamente',
      });

      const updated = await controller.updatePreferences(user, {
        career: 'Physics',
        preferredModality: PreferredModality.VIRT,
      });
      expect(updated.message).toContain('exitosamente');

      // 3. Get updated preferences
      studentService.getPreferences.mockResolvedValueOnce({
        career: 'Physics',
        preferredModality: PreferredModality.VIRT,
      });

      const retrieved = await controller.getPreferences(user);
      expect(retrieved.career).toBe('Physics');
    });

    it('handles complete CRUD flow for interested subjects', async () => {
      const user = { idUser: 'user-1', role: UserRole.STUDENT } as any;

      // 1. Get initial subjects (empty)
      studentService.getInterestedSubjects.mockResolvedValueOnce({
        subjects: [],
      });

      const initial = await controller.getInterestedSubjects(user);
      expect(initial.subjects).toHaveLength(0);

      // 2. Update subjects
      studentService.updateInterestedSubjects.mockResolvedValueOnce({
        message: 'Materias de interés actualizadas exitosamente',
      });

      const updated = await controller.updateInterestedSubjects(user, {
        subjectIds: ['subject-1', 'subject-2'],
      });
      expect(updated.message).toContain('exitosamente');

      // 3. Get updated subjects
      studentService.getInterestedSubjects.mockResolvedValueOnce({
        subjects: [
          { id: 'subject-1', name: 'Math I' },
          { id: 'subject-2', name: 'Physics I' },
        ],
      });

      const retrieved = await controller.getInterestedSubjects(user);
      expect(retrieved.subjects).toHaveLength(2);
    });
  });
});
