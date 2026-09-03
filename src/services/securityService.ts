import { db, getSettings } from '../db';

// Web Crypto API security service for password hashing and backup encryption/decryption

export async function hashPassword(password: string, existingSalt?: string): Promise<{ hash: string; salt: string }> {
  const enc = new TextEncoder();
  const salt = existingSalt 
    ? hexToBytes(existingSalt)
    : crypto.getRandomValues(new Uint8Array(16));
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const derivedKey = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );

  return {
    hash: bytesToHex(new Uint8Array(derivedKey)),
    salt: bytesToHex(salt)
  };
}

export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  const result = await hashPassword(password, salt);
  return result.hash === hash;
}

export async function initializeSecurityPassword(password: string): Promise<void> {
  const { hash, salt } = await hashPassword(password);
  const settings = await getSettings();
  if (settings) {
    await db.settings.update(settings.id!, {
      passwordHash: hash,
      passwordSalt: salt,
      updatedAt: new Date().toISOString()
    });
  } else {
    await db.settings.put({
      id: 'sett_default',
      currency: 'DA',
      isInitialized: true,
      passwordHash: hash,
      passwordSalt: salt,
      autoLockMinutes: 15,
      orderPrefix: 'OTM-2026-',
      receiptPrefix: 'REC-2026-',
      productionPrefix: 'PROD-2026-',
      nextOrderNum: 1,
      nextReceiptNum: 1,
      nextProductionNum: 1,
      updatedAt: new Date().toISOString()
    });
  }
}

export async function verifySecurityPassword(password: string): Promise<boolean> {
  const settings = await getSettings();
  if (!settings?.passwordHash || !settings?.passwordSalt) return true;
  return await verifyPassword(password, settings.passwordHash, settings.passwordSalt);
}

let memorySessionStorage: Record<string, string> = {};

function getSessionItem(key: string): string | null {
  if (typeof sessionStorage !== 'undefined') {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return memorySessionStorage[key] || null;
    }
  }
  return memorySessionStorage[key] || null;
}

function setSessionItem(key: string, value: string): void {
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.setItem(key, value);
      return;
    } catch {
      memorySessionStorage[key] = value;
    }
  }
  memorySessionStorage[key] = value;
}

function removeSessionItem(key: string): void {
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.removeItem(key);
      return;
    } catch {
      delete memorySessionStorage[key];
    }
  }
  delete memorySessionStorage[key];
}

export function lockApplicationSession(): void {
  removeSessionItem('otm_unlocked');
}

export async function unlockApplicationSession(password: string): Promise<boolean> {
  const isValid = await verifySecurityPassword(password);
  if (isValid) {
    setSessionItem('otm_unlocked', 'true');
  }
  return isValid;
}

export function isSessionUnlocked(): boolean {
  return getSessionItem('otm_unlocked') === 'true';
}

export async function encryptData(plainText: string, password: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const aesKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    aesKey,
    enc.encode(plainText)
  );

  const envelope = {
    salt: bytesToHex(salt),
    iv: bytesToHex(iv),
    ciphertext: bytesToHex(new Uint8Array(encrypted)),
    v: 1
  };

  return JSON.stringify(envelope);
}

export async function decryptData(envelopeStr: string, password: string): Promise<string> {
  let envelope: { salt: string; iv: string; ciphertext: string; v: number };
  try {
    envelope = JSON.parse(envelopeStr);
    if (!envelope.salt || !envelope.iv || !envelope.ciphertext) {
      throw new Error('Format de sauvegarde invalide');
    }
  } catch {
    throw new Error('Fichier corrompu ou format de sauvegarde invalide.');
  }

  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const salt = hexToBytes(envelope.salt);
  const iv = hexToBytes(envelope.iv);
  const ciphertext = hexToBytes(envelope.ciphertext);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const aesKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  try {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      aesKey,
      ciphertext
    );
    return dec.decode(decrypted);
  } catch {
    throw new Error('Mot de passe incorrect ou sauvegarde altérée.');
  }
}

export async function computeChecksum(str: string): Promise<string> {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(str));
  return bytesToHex(new Uint8Array(digest));
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}
