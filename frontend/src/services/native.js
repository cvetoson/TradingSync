// Bridge to native capabilities when running inside the Capacitor iOS shell.
// Every plugin import is dynamic so the web bundle never pulls native code paths.
import { Capacitor } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();

const APPLOCK_KEY = 'tradingsync_applock';

/**
 * Native photo picker for screenshot import: shows the iOS "Take Photo / Choose
 * from Library" sheet and returns a File the existing upload flow can send as-is.
 * Returns null when the user cancels.
 */
export async function pickScreenshotFile() {
  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
  let photo;
  try {
    photo = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Prompt,
      quality: 90,
      promptLabelHeader: 'Screenshot',
      promptLabelPhoto: 'Choose from Library',
      promptLabelPicture: 'Take Photo',
    });
  } catch (e) {
    if (/cancel/i.test(e?.message || '')) return null;
    throw e;
  }
  const blob = await (await fetch(photo.webPath)).blob();
  const ext = (photo.format || 'png').toLowerCase();
  return new File([blob], `screenshot.${ext}`, { type: blob.type || `image/${ext}` });
}

/**
 * Native multi-select from the photo library (long position lists need several
 * scrolled screenshots). Returns File[] — empty when the user cancels.
 */
export async function pickScreenshotFiles(limit = 5) {
  const { Camera } = await import('@capacitor/camera');
  let result;
  try {
    result = await Camera.pickImages({ quality: 90, limit });
  } catch (e) {
    if (/cancel/i.test(e?.message || '')) return [];
    throw e;
  }
  const files = [];
  for (const [i, photo] of (result?.photos || []).entries()) {
    const blob = await (await fetch(photo.webPath)).blob();
    const ext = (photo.format || 'png').toLowerCase();
    files.push(new File([blob], `screenshot-${i + 1}.${ext}`, { type: blob.type || `image/${ext}` }));
  }
  return files;
}

export function isAppLockEnabled() {
  try { return localStorage.getItem(APPLOCK_KEY) === '1'; } catch { return false; }
}

export function setAppLockEnabled(on) {
  try { on ? localStorage.setItem(APPLOCK_KEY, '1') : localStorage.removeItem(APPLOCK_KEY); } catch { /* private mode */ }
}

export async function biometricAvailable() {
  const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
  const info = await BiometricAuth.checkBiometry();
  // Device passcode counts: authenticate() falls back to it below.
  return info.isAvailable || info.deviceIsSecure;
}

/** Resolves when the user has authenticated; throws when they fail/dismiss. */
export async function biometricAuthenticate() {
  const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
  await BiometricAuth.authenticate({
    reason: 'Unlock 8Sync',
    allowDeviceCredential: true,
    iosFallbackTitle: 'Use passcode',
    cancelTitle: 'Cancel',
  });
}

/** Fires cb(isActive) on app foreground/background transitions; returns an unsubscribe. */
export async function onAppStateChange(cb) {
  if (!isNative) return () => {};
  const { App } = await import('@capacitor/app');
  const sub = await App.addListener('appStateChange', ({ isActive }) => cb(isActive));
  return () => sub.remove();
}
