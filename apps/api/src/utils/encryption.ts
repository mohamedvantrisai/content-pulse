import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SEPARATOR = ':';

/**
 * Returns the encryption key buffer from the ENCRYPTION_KEY env var.
 * Loaded lazily to avoid circular dependency with env.ts at module init.
 */
function getKeyBuffer(): Buffer {
    const hex = process.env['ENCRYPTION_KEY'];
    if (!hex || hex.length !== 64) {
        throw new Error('ENCRYPTION_KEY must be a 64-character hex string');
    }
    return Buffer.from(hex, 'hex');
}

/** Encrypts plaintext using AES-256-GCM. Returns `iv:authTag:ciphertext` (hex). */
export function encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, getKeyBuffer(), iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();
    return [iv.toString('hex'), authTag.toString('hex'), encrypted].join(SEPARATOR);
}

/** Decrypts an `iv:authTag:ciphertext` string back to plaintext. */
export function decrypt(encryptedText: string): string {
    const parts = encryptedText.split(SEPARATOR);
    if (parts.length !== 3) {
        throw new Error('Invalid encrypted text format — expected iv:authTag:ciphertext');
    }

    const [ivHex, authTagHex, ciphertext] = parts as [string, string, string];
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = createDecipheriv(ALGORITHM, getKeyBuffer(), iv);

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

/** Checks whether a value looks like an AES-256-GCM encrypted string. */
export function isEncrypted(value: string): boolean {
    if (!value) return false;
    const parts = value.split(SEPARATOR);
    if (parts.length !== 3) return false;

    const [iv, authTag] = parts as [string, string];
    return (
        iv !== undefined && iv.length === IV_LENGTH * 2 &&
        authTag !== undefined && authTag.length === AUTH_TAG_LENGTH * 2
    );
}
