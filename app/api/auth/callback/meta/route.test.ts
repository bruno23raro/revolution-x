import { GET } from './route';
import { NextRequest } from 'next/server';

describe('OAuth callback meta', () => {
  it('rejeita state ausente', async () => {
    const req = new NextRequest('http://localhost/api/auth/callback/meta?code=x');
    const res = await GET(req);
    expect(res.status).toBe(307); // redirect error
  });
  it('rejeita state inválido (cookie diferente)', async () => {
    const req = new NextRequest('http://localhost/api/auth/callback/meta?code=x&state=bad', {
      headers: { cookie: 'oauth_state=good' },
    });
    const res = await GET(req);
    expect(res.status).toBe(307);
  });
  it('rejeita code ausente', async () => {
    const req = new NextRequest('http://localhost/api/auth/callback/meta?state=good');
    const res = await GET(req);
    expect(res.status).toBe(307);
  });
  it('rejeita error OAuth', async () => {
    const req = new NextRequest('http://localhost/api/auth/callback/meta?error=access_denied');
    const res = await GET(req);
    expect(res.status).toBe(307);
  });
});
