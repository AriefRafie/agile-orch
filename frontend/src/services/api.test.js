import API, { isTokenExpired } from './api';

const jwtWithExp = (exp) => `h.${btoa(JSON.stringify({ exp })).replace(/=+$/, '')}.s`;

describe('isTokenExpired', () => {
  it('is false for a future exp', () => {
    expect(isTokenExpired(jwtWithExp(Math.floor(Date.now() / 1000) + 3600))).toBe(false);
  });
  it('is true for a past exp', () => {
    expect(isTokenExpired(jwtWithExp(Math.floor(Date.now() / 1000) - 10))).toBe(true);
  });
  it('is true for garbage', () => {
    expect(isTokenExpired('not-a-jwt')).toBe(true);
  });
});

describe('request interceptor', () => {
  const run = (config) => API.interceptors.request.handlers[0].fulfilled(config);
  afterEach(() => localStorage.clear());

  it('attaches the token on /auth/register (regression ISSUE-001)', async () => {
    localStorage.setItem('token', jwtWithExp(Math.floor(Date.now() / 1000) + 3600));
    const cfg = await run({ url: '/auth/register', headers: {} });
    expect(cfg.headers.Authorization).toMatch(/^Bearer /);
  });

  it('does not redirect on /auth/login even with an expired token', async () => {
    localStorage.setItem('token', jwtWithExp(Math.floor(Date.now() / 1000) - 10));
    const cfg = await run({ url: '/auth/login', headers: {} });
    expect(cfg.url).toBe('/auth/login');
  });

  it('rejects other requests when the token is expired and clears the session', async () => {
    localStorage.setItem('token', jwtWithExp(Math.floor(Date.now() / 1000) - 10));
    localStorage.setItem('userId', '2');
    await expect(run({ url: '/tasks/', headers: {} })).rejects.toBeTruthy();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('userId')).toBeNull();
  });
});
