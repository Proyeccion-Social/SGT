import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SubjectsService } from './subjects.service';

describe('SubjectsService', () => {
  let service: SubjectsService;
  let subjectRepository: any;
  let tutorImpartSubjectRepository: any;

  const mockSubject = { idSubject: 'sub-1', name: 'Mathematics' };

  beforeEach(() => {
    subjectRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn(),
      count: jest.fn(),
    };
    tutorImpartSubjectRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((value) => value),
      save: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    };

    service = new SubjectsService(subjectRepository, tutorImpartSubjectRepository);
  });

  // ─── findById ─────────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns subject when found', async () => {
      subjectRepository.findOne.mockResolvedValue(mockSubject);

      expect(await service.findById('sub-1')).toEqual(mockSubject);
    });

    it('returns null when not found', async () => {
      subjectRepository.findOne.mockResolvedValue(null);

      expect(await service.findById('unknown')).toBeNull();
    });
  });

  // ─── validateSubjectsExist ────────────────────────────────────────────────────

  describe('validateSubjectsExist', () => {
    it('returns true when all subjects exist', async () => {
      subjectRepository.find.mockResolvedValue([
        { idSubject: 'sub-1' },
        { idSubject: 'sub-2' },
      ]);

      expect(await service.validateSubjectsExist(['sub-1', 'sub-2'])).toBe(true);
    });

    it('returns false when some subjects are missing', async () => {
      subjectRepository.find.mockResolvedValue([{ idSubject: 'sub-1' }]);

      expect(await service.validateSubjectsExist(['sub-1', 'sub-2'])).toBe(false);
    });
  });

  // ─── exists ───────────────────────────────────────────────────────────────────

  describe('exists', () => {
    it('returns true when count is greater than 0', async () => {
      subjectRepository.count.mockResolvedValue(1);

      expect(await service.exists('sub-1')).toBe(true);
    });

    it('returns false when count is 0', async () => {
      subjectRepository.count.mockResolvedValue(0);

      expect(await service.exists('unknown')).toBe(false);
    });
  });

  // ─── findAll ──────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns paginated response with mapped subjects', async () => {
      subjectRepository.findAndCount.mockResolvedValue([
        [{ idSubject: 'sub-1', name: 'Mathematics' }],
        1,
      ]);

      const result = await service.findAll(1, 10);

      expect(result.data).toEqual([{ id: 'sub-1', name: 'Mathematics' }]);
      expect(result.meta.total).toBe(1);
    });
  });

  // ─── assignSubjectsToTutor ────────────────────────────────────────────────────

  describe('assignSubjectsToTutor', () => {
    it('throws BadRequestException when no subjects are provided', async () => {
      await expect(
        service.assignSubjectsToTutor('tutor-1', []),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when more than 3 subjects are provided', async () => {
      await expect(
        service.assignSubjectsToTutor('tutor-1', ['s1', 's2', 's3', 's4']),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when some subjects do not exist', async () => {
      subjectRepository.find.mockResolvedValue([{ idSubject: 'sub-1' }]); // only 1 of 2

      await expect(
        service.assignSubjectsToTutor('tutor-1', ['sub-1', 'sub-999']),
      ).rejects.toThrow(NotFoundException);
    });

    it('deletes previous assignments and saves new ones', async () => {
      subjectRepository.find.mockResolvedValue([
        { idSubject: 'sub-1' },
        { idSubject: 'sub-2' },
      ]);
      tutorImpartSubjectRepository.delete.mockResolvedValue({ affected: 1 });
      tutorImpartSubjectRepository.save.mockResolvedValue([]);

      await service.assignSubjectsToTutor('tutor-1', ['sub-1', 'sub-2']);

      expect(tutorImpartSubjectRepository.delete).toHaveBeenCalledWith({ idTutor: 'tutor-1' });
      expect(tutorImpartSubjectRepository.save).toHaveBeenCalled();
    });
  });

  // ─── addSubjectToTutor ────────────────────────────────────────────────────────

  describe('addSubjectToTutor', () => {
    it('throws NotFoundException when subject does not exist', async () => {
      subjectRepository.findOne.mockResolvedValue(null);

      await expect(
        service.addSubjectToTutor('tutor-1', 'sub-999'),
      ).rejects.toThrow(NotFoundException);
    });

    it('does nothing if the relation already exists', async () => {
      subjectRepository.findOne.mockResolvedValue(mockSubject);
      tutorImpartSubjectRepository.findOne.mockResolvedValue({ idTutor: 'tutor-1', idSubject: 'sub-1' });

      await service.addSubjectToTutor('tutor-1', 'sub-1');

      expect(tutorImpartSubjectRepository.save).not.toHaveBeenCalled();
    });

    it('creates and saves relation when it does not exist yet', async () => {
      subjectRepository.findOne.mockResolvedValue(mockSubject);
      tutorImpartSubjectRepository.findOne.mockResolvedValue(null);
      tutorImpartSubjectRepository.save.mockResolvedValue({});

      await service.addSubjectToTutor('tutor-1', 'sub-1');

      expect(tutorImpartSubjectRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ idTutor: 'tutor-1', idSubject: 'sub-1' }),
      );
    });
  });

  // ─── getSubjectsByTutor ───────────────────────────────────────────────────────

  describe('getSubjectsByTutor', () => {
    it('returns the subjects mapped from relations', async () => {
      tutorImpartSubjectRepository.find.mockResolvedValue([
        { subject: mockSubject },
      ]);

      const result = await service.getSubjectsByTutor('tutor-1');

      expect(result).toEqual([mockSubject]);
    });

    it('returns empty array when tutor has no subjects', async () => {
      tutorImpartSubjectRepository.find.mockResolvedValue([]);

      expect(await service.getSubjectsByTutor('tutor-1')).toEqual([]);
    });
  });

  // ─── tutorTeachesSubject ──────────────────────────────────────────────────────

  describe('tutorTeachesSubject', () => {
    it('returns true when relation exists', async () => {
      tutorImpartSubjectRepository.count.mockResolvedValue(1);

      expect(await service.tutorTeachesSubject('tutor-1', 'sub-1')).toBe(true);
    });

    it('returns false when relation does not exist', async () => {
      tutorImpartSubjectRepository.count.mockResolvedValue(0);

      expect(await service.tutorTeachesSubject('tutor-1', 'sub-1')).toBe(false);
    });
  });

  // ─── removeSubjectFromTutor / removeAllSubjectsFromTutor ─────────────────────

  describe('removeSubjectFromTutor', () => {
    it('deletes the specific tutor-subject relation', async () => {
      tutorImpartSubjectRepository.delete.mockResolvedValue({ affected: 1 });

      await service.removeSubjectFromTutor('tutor-1', 'sub-1');

      expect(tutorImpartSubjectRepository.delete).toHaveBeenCalledWith({
        idTutor: 'tutor-1',
        idSubject: 'sub-1',
      });
    });
  });

  describe('removeAllSubjectsFromTutor', () => {
    it('deletes all relations for the given tutor', async () => {
      tutorImpartSubjectRepository.delete.mockResolvedValue({ affected: 2 });

      await service.removeAllSubjectsFromTutor('tutor-1');

      expect(tutorImpartSubjectRepository.delete).toHaveBeenCalledWith({ idTutor: 'tutor-1' });
    });
  });
});
