import { validate } from 'class-validator';
import { WithdrawSessionDto } from './withdraw-session.dto';

describe('WithdrawSessionDto', () => {
  it('accepts an omitted reason', async () => {
    const dto = Object.assign(new WithdrawSessionDto(), {});

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('accepts a reason within the allowed length', async () => {
    const dto = Object.assign(new WithdrawSessionDto(), {
      reason: 'Ya no necesito la tutoría',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects a reason shorter than 10 characters', async () => {
    const dto = Object.assign(new WithdrawSessionDto(), { reason: 'corto' });

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });

  it('rejects a reason longer than 500 characters', async () => {
    const dto = Object.assign(new WithdrawSessionDto(), {
      reason: 'a'.repeat(501),
    });

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });
});
