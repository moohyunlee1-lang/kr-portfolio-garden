import { describe, it, expect } from 'vitest';
import { sanctuaryUrl } from './sanctuary';
describe('independent sanctuary link',()=>{
 it('preserves leading zeros and sends no portfolio or religion',()=>{
  expect(sanctuaryUrl('005930','https://sanctuary.example')).toBe('https://sanctuary.example/rooms/KRX/005930');
 });
 it('rejects malformed stock codes instead of repairing',()=>{
  for(const code of ['5930','005930 ','../123','https://evil.test']) expect(sanctuaryUrl(code,'https://sanctuary.example')).toBeNull();
 });
 it('rejects unsafe or ambiguous origins',()=>{
  for(const origin of ['javascript:alert(1)','https://user:pass@example.com','https://example.com/?token=x','https://example.com/#x','http://example.com','https://example.com/path']) expect(sanctuaryUrl('005930',origin)).toBeNull();
 });
 it('allows explicit loopback development and fails closed if unset',()=>{
  expect(sanctuaryUrl('005930','http://127.0.0.1:8787')).toBe('http://127.0.0.1:8787/rooms/KRX/005930');
  expect(sanctuaryUrl('005930',undefined)).toBeNull();
 });
});
