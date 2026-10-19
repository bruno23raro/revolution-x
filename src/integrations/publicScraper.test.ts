import { isSafePublicUrl } from './publicScraper';

describe('isSafePublicUrl', () => {
  it('should return false for private/local IPs', () => {
    expect(isSafePublicUrl('http://127.0.0.1')).toBe(false);
    expect(isSafePublicUrl('http://192.168.1.1')).toBe(false);
    expect(isSafePublicUrl('http://10.0.0.1')).toBe(false);
    expect(isSafePublicUrl('http://172.16.0.1')).toBe(false);
    expect(isSafePublicUrl('http://169.254.169.254')).toBe(false);
  });

  it('should return false for localhost', () => {
    expect(isSafePublicUrl('http://localhost')).toBe(false);
  });

  it('should return true for public URLs', () => {
    expect(isSafePublicUrl('https://www.google.com')).toBe(true);
    expect(isSafePublicUrl('https://example.com/path')).toBe(true);
  });
});
