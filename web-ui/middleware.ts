import { NextRequest, NextResponse } from 'next/server';

function hasAuthConfig() {
  return Boolean(process.env.REVIEW_UI_USERNAME && process.env.REVIEW_UI_PASSWORD);
}

function parseBasicAuth(headerValue: string | null) {
  if (!headerValue?.startsWith('Basic ')) {
    return null;
  }

  try {
    const decoded = atob(headerValue.slice(6));
    const separatorIndex = decoded.indexOf(':');
    if (separatorIndex === -1) {
      return null;
    }

    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1)
    };
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  if (!hasAuthConfig()) {
    return NextResponse.next();
  }

  const expectedUsername = process.env.REVIEW_UI_USERNAME ?? '';
  const expectedPassword = process.env.REVIEW_UI_PASSWORD ?? '';
  const credentials = parseBasicAuth(request.headers.get('authorization'));

  if (
    credentials?.username === expectedUsername &&
    credentials?.password === expectedPassword
  ) {
    return NextResponse.next();
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="DJ Review UI", charset="UTF-8"'
    }
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
