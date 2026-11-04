import { ConfigService } from '@nestjs/config';

const LOCALHOST_ORIGIN = /^http:\/\/localhost(?::\d+)?$/;
const VERCEL_PREVIEW_ORIGIN =
  /^https:\/\/atlas-[a-zA-Z0-9-]+-proysocialuds-projects\.vercel\.app$/;

export const isAllowedFrontendUrl = (value: unknown): value is string => {
  if (typeof value !== 'string' || !value) return false;

  try {
    const url = new URL(value);
    if (
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      url.username ||
      url.password
    ) {
      return false;
    }

    return (
      LOCALHOST_ORIGIN.test(url.origin) ||
      url.origin === 'https://atlas-test.proysocial.org' ||
      url.origin === 'https://atlas.proysocial.org' ||
      VERCEL_PREVIEW_ORIGIN.test(url.origin)
    );
  } catch {
    return false;
  }
};

export const resolveFrontendUrl = (
  configService: ConfigService,
  requestedUrl?: string,
): string => {
  if (isAllowedFrontendUrl(requestedUrl)) return new URL(requestedUrl).origin;

  const configuredUrl =
    configService.get<string>('FRONTEND_URL') ?? process.env.FRONTEND_URL;

  if (isAllowedFrontendUrl(configuredUrl)) {
    return new URL(configuredUrl).origin;
  }

  return 'http://localhost:3000';
};
