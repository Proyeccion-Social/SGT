import { AppController } from './app.controller';

describe('AppController', () => {
  it('returns an ok status from the root endpoint', () => {
    const controller = new AppController();

    expect(controller.getStatus()).toEqual({ status: 'ok' });
  });
});
