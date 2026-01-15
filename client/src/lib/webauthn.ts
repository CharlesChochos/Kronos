const CREDENTIAL_ID_KEY = 'kronos-webauthn-credential-id';
const USER_ID_KEY = 'kronos-biometric-user-id';

export function isWebAuthnSupported(): boolean {
  return !!(
    window.PublicKeyCredential &&
    typeof window.PublicKeyCredential === 'function'
  );
}

export async function isBiometricAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  
  try {
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return available;
  } catch {
    return false;
  }
}

export function hasStoredCredential(): boolean {
  return !!localStorage.getItem(CREDENTIAL_ID_KEY);
}

export function getStoredCredentialId(): string | null {
  return localStorage.getItem(CREDENTIAL_ID_KEY);
}

export function storeCredentialId(credentialId: string): void {
  localStorage.setItem(CREDENTIAL_ID_KEY, credentialId);
}

export function storeUserId(userId: string): void {
  localStorage.setItem(USER_ID_KEY, userId);
}

export function getStoredUserId(): string | null {
  return localStorage.getItem(USER_ID_KEY);
}

export function removeStoredCredential(): void {
  localStorage.removeItem(CREDENTIAL_ID_KEY);
  localStorage.removeItem(USER_ID_KEY);
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBuffer(base64url: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function registerBiometric(userId: string, userName: string): Promise<{ success: boolean; credentialId?: string; error?: string }> {
  if (!isWebAuthnSupported()) {
    return { success: false, error: 'WebAuthn not supported' };
  }

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    
    const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: {
        name: 'Kronos',
        id: window.location.hostname,
      },
      user: {
        id: new TextEncoder().encode(userId),
        name: userName,
        displayName: userName,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },
        { alg: -257, type: 'public-key' },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
      attestation: 'none',
    };

    const credential = await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions,
    }) as PublicKeyCredential;

    if (!credential) {
      return { success: false, error: 'Failed to create credential' };
    }

    const credentialId = bufferToBase64Url(credential.rawId);
    storeCredentialId(credentialId);
    storeUserId(userId);

    return { success: true, credentialId };
  } catch (error: any) {
    console.error('[WebAuthn] Registration error:', error);
    return { success: false, error: error.message || 'Registration failed' };
  }
}

export async function authenticateWithBiometric(): Promise<{ success: boolean; error?: string }> {
  if (!isWebAuthnSupported()) {
    return { success: false, error: 'WebAuthn not supported' };
  }

  const storedCredentialId = getStoredCredentialId();
  if (!storedCredentialId) {
    return { success: false, error: 'No stored credential' };
  }

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    
    const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      allowCredentials: [{
        id: base64UrlToBuffer(storedCredentialId),
        type: 'public-key',
        transports: ['internal'],
      }],
      userVerification: 'required',
      timeout: 60000,
    };

    const assertion = await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions,
    }) as PublicKeyCredential;

    if (!assertion) {
      return { success: false, error: 'Authentication failed' };
    }

    return { success: true };
  } catch (error: any) {
    console.error('[WebAuthn] Authentication error:', error);
    
    if (error.name === 'NotAllowedError') {
      return { success: false, error: 'Authentication cancelled' };
    }
    
    return { success: false, error: error.message || 'Authentication failed' };
  }
}
