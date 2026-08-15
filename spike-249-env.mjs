// Shim import.meta.env for Node.js so gaapNormalizer.js doesn't throw
// gaapNormalizer uses import.meta.env.DEV for dev-only logging
import { register } from 'module';
// Node 20.6+ loader hooks approach — simpler: patch via globalThis
// since import.meta.env.DEV is only read inside a function, we can
// inject it at module level via a custom loader that replaces the check.
// Simplest: use --experimental-vm-modules? No.
// Actually the easiest is a source transform loader:
export async function resolve(specifier, context, next) {
  return next(specifier, context);
}
export async function load(url, context, next) {
  const result = await next(url, context);
  if (url.includes('gaapNormalizer') && result.format === 'module') {
    // Replace import.meta.env.DEV with false so devLog short-circuits
    result.source = result.source.toString().replace(/import\.meta\.env\.DEV/g, 'false');
  }
  return result;
}
