// @ts-check
import { test, expect } from './fixtures.js';

// All crypto tests run inside the browser context since Web Crypto API is browser-only.

const PEER_PARAMS = '?peerHost=127.0.0.1&peerPort=9000';

test.describe('E2E Encryption', () => {
  test('generates an ECDH key pair', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const result = await page.evaluate(async () => {
      const kp = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        ['deriveKey']
      );
      return {
        hasPublic: kp.publicKey instanceof CryptoKey,
        hasPrivate: kp.privateKey instanceof CryptoKey,
        publicType: kp.publicKey.type,
        privateType: kp.privateKey.type,
      };
    });

    expect(result.hasPublic).toBe(true);
    expect(result.hasPrivate).toBe(true);
    expect(result.publicType).toBe('public');
    expect(result.privateType).toBe('private');
  });

  test('exports and imports a public key roundtrip', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const result = await page.evaluate(async () => {
      const params = { name: 'ECDH', namedCurve: 'P-256' };
      const kp = await crypto.subtle.generateKey(params, false, ['deriveKey']);

      const exported = await crypto.subtle.exportKey('raw', kp.publicKey);
      const rawArray = Array.from(new Uint8Array(exported));

      const imported = await crypto.subtle.importKey(
        'raw',
        new Uint8Array(rawArray),
        params,
        true,
        []
      );

      return {
        exportedLength: rawArray.length,
        importedType: imported.type,
        importedAlgorithm: imported.algorithm.name,
      };
    });

    // P-256 uncompressed public key is 65 bytes
    expect(result.exportedLength).toBe(65);
    expect(result.importedType).toBe('public');
    expect(result.importedAlgorithm).toBe('ECDH');
  });

  test('two key pairs derive the same shared secret', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const result = await page.evaluate(async () => {
      const params = { name: 'ECDH', namedCurve: 'P-256' };
      const aesParams = { name: 'AES-GCM', length: 256 };

      const alice = await crypto.subtle.generateKey(params, false, ['deriveKey']);
      const bob = await crypto.subtle.generateKey(params, false, ['deriveKey']);

      // Exchange public keys and derive shared secrets
      const aliceShared = await crypto.subtle.deriveKey(
        { name: 'ECDH', public: bob.publicKey },
        alice.privateKey,
        aesParams,
        true,
        ['encrypt', 'decrypt']
      );

      const bobShared = await crypto.subtle.deriveKey(
        { name: 'ECDH', public: alice.publicKey },
        bob.privateKey,
        aesParams,
        true,
        ['encrypt', 'decrypt']
      );

      // Export both to compare
      const aliceRaw = Array.from(new Uint8Array(await crypto.subtle.exportKey('raw', aliceShared)));
      const bobRaw = Array.from(new Uint8Array(await crypto.subtle.exportKey('raw', bobShared)));

      return {
        aliceKeyLength: aliceRaw.length,
        bobKeyLength: bobRaw.length,
        keysMatch: JSON.stringify(aliceRaw) === JSON.stringify(bobRaw),
      };
    });

    expect(result.aliceKeyLength).toBe(32); // 256 bits
    expect(result.bobKeyLength).toBe(32);
    expect(result.keysMatch).toBe(true);
  });

  test('encrypt then decrypt roundtrip', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const result = await page.evaluate(async () => {
      const params = { name: 'ECDH', namedCurve: 'P-256' };
      const aesParams = { name: 'AES-GCM', length: 256 };

      const alice = await crypto.subtle.generateKey(params, false, ['deriveKey']);
      const bob = await crypto.subtle.generateKey(params, false, ['deriveKey']);

      const sharedKey = await crypto.subtle.deriveKey(
        { name: 'ECDH', public: bob.publicKey },
        alice.privateKey,
        aesParams,
        false,
        ['encrypt', 'decrypt']
      );

      const plaintext = 'Hello, encrypted world! 🔐';
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encoded = new TextEncoder().encode(plaintext);

      const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        sharedKey,
        encoded
      );

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        sharedKey,
        ciphertext
      );

      const result = new TextDecoder().decode(decrypted);
      return {
        original: plaintext,
        decrypted: result,
        ciphertextLength: new Uint8Array(ciphertext).length,
      };
    });

    expect(result.decrypted).toBe(result.original);
    expect(result.ciphertextLength).toBeGreaterThan(0);
  });

  test('decryption with wrong key fails', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const result = await page.evaluate(async () => {
      const params = { name: 'ECDH', namedCurve: 'P-256' };
      const aesParams = { name: 'AES-GCM', length: 256 };

      const alice = await crypto.subtle.generateKey(params, false, ['deriveKey']);
      const bob = await crypto.subtle.generateKey(params, false, ['deriveKey']);
      const eve = await crypto.subtle.generateKey(params, false, ['deriveKey']);

      // Alice encrypts with Alice-Bob shared key
      const correctKey = await crypto.subtle.deriveKey(
        { name: 'ECDH', public: bob.publicKey },
        alice.privateKey,
        aesParams,
        false,
        ['encrypt', 'decrypt']
      );

      // Eve tries to decrypt with Alice-Eve shared key
      const wrongKey = await crypto.subtle.deriveKey(
        { name: 'ECDH', public: alice.publicKey },
        eve.privateKey,
        aesParams,
        false,
        ['encrypt', 'decrypt']
      );

      const plaintext = 'Secret message';
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encoded = new TextEncoder().encode(plaintext);

      const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        correctKey,
        encoded
      );

      try {
        await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv },
          wrongKey,
          ciphertext
        );
        return { decryptionFailed: false };
      } catch {
        return { decryptionFailed: true };
      }
    });

    expect(result.decryptionFailed).toBe(true);
  });

  test('each encryption produces unique ciphertext (random IV)', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const result = await page.evaluate(async () => {
      const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );

      const plaintext = new TextEncoder().encode('Same message');
      const results = [];

      for (let i = 0; i < 3; i++) {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
        results.push(JSON.stringify(Array.from(new Uint8Array(ct))));
      }

      return {
        allUnique: new Set(results).size === results.length,
        count: results.length,
      };
    });

    expect(result.allUnique).toBe(true);
    expect(result.count).toBe(3);
  });
});
