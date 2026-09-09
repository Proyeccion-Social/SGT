import { resolveFrontendUrl, isAllowedFrontendUrl } from './frontend-url';

describe('frontend URL validation', () => {
  it('accepts configured local, staging, production and project preview origins', () => {
    expect(isAllowedFrontendUrl('http://localhost:3000')).toBe(true);
    expect(isAllowedFrontendUrl('https://atlas-test.proysocial.org')).toBe(
      true,
    );
    expect(isAllowedFrontendUrl('https://atlas.proysocial.org')).toBe(true);
    expect(
      isAllowedFrontendUrl(
        'https://atlas-isuib5m5n-proysocialuds-projects.vercel.app',
      ),
    ).toBe(true);
    expect(
      resolveFrontendUrl(
        { get: jest.fn() } as any,
        'https://atlas-13w9fjirx-proysocialuds-projects.vercel.app/',
      ),
    ).toBe('https://atlas-13w9fjirx-proysocialuds-projects.vercel.app');
  });

  it('rejects phishing origins and URLs with paths', () => {
    expect(
      isAllowedFrontendUrl('https://atlas.proysocial.org.attacker.com'),
    ).toBe(false);
    expect(isAllowedFrontendUrl('https://atlas.proysocial.org/login')).toBe(
      false,
    );
    expect(
      isAllowedFrontendUrl('https://atlas.proysocial.org/?token=abc'),
    ).toBe(false);
    expect(isAllowedFrontendUrl('https://evil.vercel.app')).toBe(false);
  });

  it('uses the requested origin, configured fallback, then local fallback', () => {
    const configService = {
      get: jest.fn().mockReturnValue('https://atlas-test.proysocial.org'),
    } as any;

    expect(
      resolveFrontendUrl(
        configService,
        'https://atlas-iok6ek85-proysocialuds-projects.vercel.app',
      ),
    ).toBe('https://atlas-iok6ek85-proysocialuds-projects.vercel.app');
    expect(resolveFrontendUrl(configService, 'https://evil.example.com')).toBe(
      'https://atlas-test.proysocial.org',
    );
    expect(
      resolveFrontendUrl({ get: jest.fn().mockReturnValue(undefined) } as any),
    ).toBe('http://localhost:3000');
  });
});
