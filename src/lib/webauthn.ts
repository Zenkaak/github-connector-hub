/**
 * WebAuthn / Fingerprint authentication helpers.
 * Uses the Web Authentication API for biometric login.
 */

const CREDENTIAL_KEY = 'datavend-webauthn-cred';

type SavedCredential = {
  credentialId: string;
  email: string;
  userId: string;
  token?: string;
  rpId?: string;
};

function base64urlEncode(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlDecode(str: string): ArrayBuffer {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function getCurrentRpId(): string {
  return window.location.hostname;
}

function readSavedCredential(): SavedCredential | null {
  try {
    const raw = localStorage.getItem(CREDENTIAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedCredential;

    if (!parsed?.credentialId || !parsed?.email || !parsed?.userId) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function isWebAuthnSupported(): boolean {
  return !!(window.PublicKeyCredential && navigator.credentials);
}

export function hasSavedCredential(): boolean {
  const saved = readSavedCredential();
  if (!saved) return false;

  // Credential was registered on a different domain.
  if (saved.rpId && saved.rpId !== getCurrentRpId()) return false;

  return true;
}

export function getSavedEmail(): string | null {
  const saved = readSavedCredential();
  if (!saved) return null;
  if (saved.rpId && saved.rpId !== getCurrentRpId()) return null;
  return saved.email;
}

/**
 * Register a new fingerprint credential for the current user.
 */
export async function registerFingerprint(userId: string, email: string, password?: string): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const rpId = getCurrentRpId();

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: 'DataVend Ventures',
          id: rpId,
        },
        user: {
          id: new TextEncoder().encode(userId),
          name: email,
          displayName: email,
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' }, // ES256
          { alg: -257, type: 'public-key' }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
      },
    })) as PublicKeyCredential;

    if (!credential) return false;

    const credData: SavedCredential = {
      credentialId: base64urlEncode(credential.rawId),
      email,
      userId,
      token: btoa(encodeURIComponent(password || '')),
      rpId,
    };

    localStorage.setItem(CREDENTIAL_KEY, JSON.stringify(credData));
    return true;
  } catch (e) {
    console.error('Fingerprint registration failed:', e);
    return false;
  }
}

/**
 * Keep stored fingerprint login password in sync after successful password login.
 */
export function syncFingerprintPassword(userId: string, email: string, password: string): boolean {
  const saved = readSavedCredential();
  if (!saved) return false;
  if (saved.rpId && saved.rpId !== getCurrentRpId()) return false;

  // Safety: update only when it is clearly the same account.
  if (saved.userId !== userId && saved.email !== email) return false;

  const updated: SavedCredential = {
    ...saved,
    userId,
    email,
    token: btoa(encodeURIComponent(password)),
    rpId: saved.rpId || getCurrentRpId(),
  };

  localStorage.setItem(CREDENTIAL_KEY, JSON.stringify(updated));
  return true;
}

/**
 * Authenticate using saved fingerprint.
 * Returns the email and password associated with the credential.
 */
export async function authenticateWithFingerprint(): Promise<{ email: string; password: string } | null> {
  if (!isWebAuthnSupported()) return null;

  try {
    const stored = readSavedCredential();
    if (!stored) return null;

    if (stored.rpId && stored.rpId !== getCurrentRpId()) {
      removeFingerprint();
      return null;
    }

    const challenge = crypto.getRandomValues(new Uint8Array(32));

    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [
          {
            id: base64urlDecode(stored.credentialId),
            type: 'public-key',
            transports: ['internal'],
          },
        ],
        userVerification: 'required',
        timeout: 60000,
      },
    })) as PublicKeyCredential;

    if (!assertion) return null;

    const password = stored.token ? decodeURIComponent(atob(stored.token)) : '';
    return { email: stored.email, password };
  } catch (e) {
    console.error('Fingerprint auth failed:', e);
    return null;
  }
}

export function removeFingerprint(): void {
  try {
    localStorage.removeItem(CREDENTIAL_KEY);
  } catch {}
}

