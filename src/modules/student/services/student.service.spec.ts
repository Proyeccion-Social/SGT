import { StudentService } from './student.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PreferredModality } from '../entities/student.entity';

describe('StudentService', () => {
  let service: StudentService;
  let studentRepository: any;
  let studentInterestedSubjectRepository: any;
  let subjectsService: any;

  beforeEach(() => {
    studentRepository = {
      findOne: jest.fn(),
      create: jest.fn((value) => value),
      save: jest.fn(),
    };

    studentInterestedSubjectRepository = {
      find: jest.fn(),
      delete: jest.fn(),
      save: jest.fn(),
    };

    subjectsService = {
      validateSubjectsExist: jest.fn(),
    };

    service = new StudentService(
      studentRepository,
      studentInterestedSubjectRepository,
      subjectsService,
    );
  });

  // ─── createFromUser ───────────────────────────────────────────────────────────

  describe('createFromUser', () => {
    it('creates a student record with null career and modality', async () => {
      studentRepository.save.mockResolvedValue({
        idUser: 'user-1',
        career: null,
        preferredModality: null,
      });

      const result = await service.createFromUser('user-1');

      expect(studentRepository.create).toHaveBeenCalledWith({
        idUser: 'user-1',
        career: null,
        preferredModality: null,
      });
      expect(studentRepository.save).toHaveBeenCalled();
      expect(result.idUser).toBe('user-1');
    });
  });

  // ─── isProfileComplete ────────────────────────────────────────────────────────

  describe('isProfileComplete', () => {
    it('returns true when both career and preferredModality are set', async () => {
      studentRepository.findOne.mockResolvedValue({
        idUser: 'user-1',
        career: 'Systems Engineering',
        preferredModality: 'VIRTUAL',
      });

      expect(await service.isProfileComplete('user-1')).toBe(true);
    });

    it('returns false when career is missing', async () => {
      studentRepository.findOne.mockResolvedValue({
        idUser: 'user-1',
        career: null,
        preferredModality: 'VIRTUAL',
      });

      expect(await service.isProfileComplete('user-1')).toBe(false);
    });

    it('returns false when preferredModality is missing', async () => {
      studentRepository.findOne.mockResolvedValue({
        idUser: 'user-1',
        career: 'Systems Engineering',
        preferredModality: null,
      });

      expect(await service.isProfileComplete('user-1')).toBe(false);
    });

    it('returns false when student record does not exist', async () => {
      studentRepository.findOne.mockResolvedValue(null);

      expect(await service.isProfileComplete('nonexistent')).toBe(false);
    });
  });

  // ─── findByUserId ─────────────────────────────────────────────────────────────

  describe('findByUserId', () => {
    it('returns the student when found', async () => {
      const student = { idUser: 'user-1', career: 'Systems Engineering' };
      studentRepository.findOne.mockResolvedValue(student);

      const result = await service.findByUserId('user-1');

      expect(result).toEqual(student);
    });

    it('returns null when student does not exist', async () => {
      studentRepository.findOne.mockResolvedValue(null);

      const result = await service.findByUserId('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ─── getPreferences ───────────────────────────────────────────────────────────

  describe('getPreferences', () => {
    it('returns student preferences when student exists', async () => {
      studentRepository.findOne.mockResolvedValue({
        idUser: 'user-1',
        career: 'Physics',
        preferredModality: PreferredModality.VIRT,
      });

      const result = await service.getPreferences('user-1');

      expect(result).toEqual({
        career: 'Physics',
        preferredModality: PreferredModality.VIRT,
      });
    });

    it('returns null values when preferences are not set', async () => {
      studentRepository.findOne.mockResolvedValue({
        idUser: 'user-1',
        career: null,
        preferredModality: null,
      });

      const result = await service.getPreferences('user-1');

      expect(result).toEqual({
        career: null,
        preferredModality: null,
      });
    });

    it('throws NotFoundException when student does not exist', async () => {
      studentRepository.findOne.mockResolvedValue(null);

      await expect(service.getPreferences('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── updatePreferences ────────────────────────────────────────────────────────

  describe('updatePreferences', () => {
    it('updates both career and modality', async () => {
      const student = {
        idUser: 'user-1',
        career: null,
        preferredModality: null,
      };
      studentRepository.findOne.mockResolvedValue(student);
      studentRepository.save.mockResolvedValue({
        ...student,
        career: 'Math',
        preferredModality: PreferredModality.PRES,
      });

      const result = await service.updatePreferences('user-1', {
        career: 'Math',
        preferredModality: PreferredModality.PRES,
      });

      expect(result.message).toContain('exitosamente');
      expect(studentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          career: 'Math',
          preferredModality: PreferredModality.PRES,
        }),
      );
    });

    it('updates only career when modality is not provided', async () => {
      const student = {
        idUser: 'user-1',
        career: null,
        preferredModality: PreferredModality.VIRT,
      };
      studentRepository.findOne.mockResolvedValue(student);

      await service.updatePreferences('user-1', { career: 'Biology' });

      expect(studentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          career: 'Biology',
          preferredModality: PreferredModality.VIRT,
        }),
      );
    });

    it('throws NotFoundException when student does not exist', async () => {
      studentRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updatePreferences('nonexistent', { career: 'Math' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getInterestedSubjects ─────────────────────────────────────────────────────

  describe('getInterestedSubjects', () => {
    it('returns list of interested subjects', async () => {
      studentRepository.findOne.mockResolvedValue({ idUser: 'user-1' });
      studentInterestedSubjectRepository.find.mockResolvedValue([
        {
          idStudent: 'user-1',
          idSubject: 'subject-1',
          subject: { name: 'Math I' },
        },
        {
          idStudent: 'user-1',
          idSubject: 'subject-2',
          subject: { name: 'Physics I' },
        },
      ]);

      const result = await service.getInterestedSubjects('user-1');

      expect(result.subjects).toHaveLength(2);
      expect(result.subjects[0]).toEqual({
        id: 'subject-1',
        name: 'Math I',
      });
      expect(result.subjects[1]).toEqual({
        id: 'subject-2',
        name: 'Physics I',
      });
    });

    it('returns empty array when student has no interested subjects', async () => {
      studentRepository.findOne.mockResolvedValue({ idUser: 'user-1' });
      studentInterestedSubjectRepository.find.mockResolvedValue([]);

      const result = await service.getInterestedSubjects('user-1');

      expect(result.subjects).toHaveLength(0);
    });

    it('throws NotFoundException when student does not exist', async () => {
      studentRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getInterestedSubjects('nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── updateInterestedSubjects ──────────────────────────────────────────────────

  describe('updateInterestedSubjects', () => {
    it('updates interested subjects successfully', async () => {
      studentRepository.findOne.mockResolvedValue({ idUser: 'user-1' });
      subjectsService.validateSubjectsExist.mockResolvedValue(true);

      await service.updateInterestedSubjects('user-1', {
        subjectIds: ['subject-1', 'subject-2'],
      });

      expect(studentInterestedSubjectRepository.delete).toHaveBeenCalledWith({
        idStudent: 'user-1',
      });
      expect(studentInterestedSubjectRepository.save).toHaveBeenCalled();
    });

    it('handles empty array of subject IDs', async () => {
      studentRepository.findOne.mockResolvedValue({ idUser: 'user-1' });

      await service.updateInterestedSubjects('user-1', { subjectIds: [] });

      expect(studentInterestedSubjectRepository.delete).toHaveBeenCalledWith({
        idStudent: 'user-1',
      });
      // Should not call save with empty array
      const saveCall = studentInterestedSubjectRepository.save.mock.calls;
      if (saveCall.length > 0) {
        expect(saveCall[saveCall.length - 1][0]).toEqual([]);
      }
    });

    it('throws NotFoundException when subject does not exist', async () => {
      studentRepository.findOne.mockResolvedValue({ idUser: 'user-1' });
      subjectsService.validateSubjectsExist.mockResolvedValue(false);

      await expect(
        service.updateInterestedSubjects('user-1', {
          subjectIds: ['invalid-subject'],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when there are duplicate subject IDs', async () => {
      studentRepository.findOne.mockResolvedValue({ idUser: 'user-1' });

      await expect(
        service.updateInterestedSubjects('user-1', {
          subjectIds: ['subject-1', 'subject-1', 'subject-2'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when student does not exist', async () => {
      studentRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateInterestedSubjects('nonexistent', { subjectIds: [] }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getPreferencesById ────────────────────────────────────────────────────────

  describe('getPreferencesById', () => {
    it('returns student preferences by ID', async () => {
      studentRepository.findOne.mockResolvedValue({
        idUser: 'student-1',
        career: 'Computer Science',
        preferredModality: PreferredModality.VIRT,
      });

      const result = await service.getPreferencesById('student-1');

      expect(result).toEqual({
        career: 'Computer Science',
        preferredModality: PreferredModality.VIRT,
      });
    });

    it('throws NotFoundException when student does not exist', async () => {
      studentRepository.findOne.mockResolvedValue(null);

      await expect(service.getPreferencesById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── getInterestedSubjectsById ─────────────────────────────────────────────────

  describe('getInterestedSubjectsById', () => {
    it('returns student interested subjects by ID', async () => {
      studentRepository.findOne.mockResolvedValue({ idUser: 'student-1' });
      studentInterestedSubjectRepository.find.mockResolvedValue([
        {
          idStudent: 'student-1',
          idSubject: 'subject-1',
          subject: { name: 'Math I' },
        },
      ]);

      const result = await service.getInterestedSubjectsById('student-1');

      expect(result.subjects).toHaveLength(1);
      expect(result.subjects[0]).toEqual({
        id: 'subject-1',
        name: 'Math I',
      });
    });

    it('throws NotFoundException when student does not exist', async () => {
      studentRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getInterestedSubjectsById('nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
