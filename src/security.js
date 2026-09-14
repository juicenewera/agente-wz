import crypto from 'node:crypto';

export function assinaturaHmacValida({ rawBody, secret, received }) {
  if (!secret) return true;
  if (!rawBody || !received) return false;
  const esperado = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const a = Buffer.from(esperado);
  const b = Buffer.from(String(received));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
