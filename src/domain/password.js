import { pbkdf2, randomBytes, timingSafeEqual, createHmac } from 'node:crypto';
const legacyIterations = 600000;
const cloudIterations = 100000;
export function passwordOptions(env = {}) {
  if (env.PASSWORD_PROFILE !== 'cloudflare-v1') return {};
  if (!/^[a-f0-9]{64}$/.test(env.AUTH_PEPPER || '')) throw new Error('Password protection secret unavailable.');
  return { pepper: env.AUTH_PEPPER };
}
const derive = (password, salt, iterations) => new Promise((resolve, reject) => {
  pbkdf2(password, salt, iterations, 32, 'sha256', (error, result) => error ? reject(error) : resolve(result));
});
export function validPassword(value) {
  return typeof value === 'string' && value.length >= 12 && value.length <= 128;
}
const protect = (value, pepper) => createHmac('sha256', Buffer.from(pepper, 'hex')).update(value).digest();
export async function hashPassword(password, { pepper } = {}) {
  if (!validPassword(password)) throw new Error('Use uma senha entre 12 e 128 caracteres.');
  if (pepper !== undefined && !/^[a-f0-9]{64}$/.test(pepper)) throw new Error('Invalid password protection secret.');
  const salt = randomBytes(16).toString('hex');
  const count = pepper ? cloudIterations : legacyIterations;
  const derived = await derive(password, salt, count);
  const hash = pepper ? protect(derived, pepper) : derived;
  return `${pepper ? 'pbkdf2-sha256-hmac-v1' : 'pbkdf2-sha256'}$${count}$${salt}$${hash.toString('hex')}`;
}
export async function verifyPassword(password, stored, { pepper } = {}) {
  if (typeof password !== 'string' || password.length > 128 || typeof stored !== 'string') return false;
  const [algorithm, count, salt, hash, extra] = stored.split('$');
  const expectedAlgorithm = pepper ? 'pbkdf2-sha256-hmac-v1' : 'pbkdf2-sha256';
  const expectedCount = pepper ? cloudIterations : legacyIterations;
  // Never accept unpeppered or legacy hashes in production, or caller-controlled work factors.
  if (algorithm !== expectedAlgorithm || Number(count) !== expectedCount || extra !== undefined || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{64}$/.test(hash)) return false;
  const derived = await derive(password, salt, expectedCount);
  const actual = pepper ? protect(derived, pepper) : derived;
  return timingSafeEqual(actual, Buffer.from(hash, 'hex'));
}
export const dummyHash = `pbkdf2-sha256$${legacyIterations}$00000000000000000000000000000000$${'0'.repeat(64)}`;
export const dummyPasswordHash = ({ pepper } = {}) => pepper ? `pbkdf2-sha256-hmac-v1$${cloudIterations}$00000000000000000000000000000000$${'0'.repeat(64)}` : dummyHash;
