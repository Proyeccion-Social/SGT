import { StudentService } from './student.service';

describe('StudentService', () => {
  let service: StudentService;
  let studentRepository: any;

  beforeEach(() => {
    studentRepository = {
      findOne: jest.fn(),
      create: jest.fn((value) => value),
      save: jest.fn(),
    };

    service = new StudentService(studentRepository);
  });

  // ─── createFromUser ───────────────────────────────────────────────────────────

  describe('createFromUser', () => {
    it('creates a student record with null career and modality', async () => {
      studentRepository.save.mockResolvedValue({ idUser: 'user-1', career: null, preferredModality: null });

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
});
