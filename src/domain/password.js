import { pbkdf2, randomBytes, timingSafeEqual } from 'node:crypto';
const iterations = 600000;
const derive = (password, salt) => new Promise((resolve, reject) => {
  pbkdf2(password, salt, iterations, 32, 'sha256', (error, result) => error ? reject(error) : resolve(result));
});
export function validPassword(value) {
  return typeof value === 'string' && value.length >= 12 && value.length <= 128;
}
export async function hashPassword(password) {
  if (!validPassword(password)) throw new Error('Use uma senha entre 12 e 128 caracteres.');
  const salt = randomBytes(16).toString('hex');
  return `pbkdf2-sha256$${iterations}$${salt}$${(await derive(password, salt)).toString('hex')}`;
}
export async function verifyPassword(password, stored) {
  const [algorithm, count, salt, hash] = stored.split('$');
  if (algorithm !== 'pbkdf2-sha256' || Number(count) !== iterations || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{64}$/.test(hash)) return false;
  const actual = await derive(password, salt);
  return timingSafeEqual(actual, Buffer.from(hash, 'hex'));
}
export const dummyHash = `pbkdf2-sha256$${iterations}$00000000000000000000000000000000$${'0'.repeat(64)}`;
