// @ts-check
import { test, expect } from '@playwright/test';

const PEER_PARAMS = '?peerHost=127.0.0.1&peerPort=9000';

test.describe('ECDH Key Generation Properties', () => {
  test('private key is non-extractable', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const result = await page.evaluate(async () => {
      const kp = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        ['deriveKey']
      );
      return { extractable: kp.privateKey.extractable };
    });
    expect(result.extractable).toBe(false);
  });

  test('private key has correct algorithm name', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const result = await page.evaluate(async () => {
      const kp = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        ['deriveKey']
      );
      return { algorithm: kp.privateKey.algorithm.name };
    });
    expect(result.algorithm).toBe('ECDH');
  });

  test('public key uses P-256 named curve', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const result = await page.evaluate(async () => {
      const kp = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        ['deriveKey']
      );
      return { curve: kp.publicKey.algorithm.namedCurve };
    });
    expect(result.curve).toBe('P-256');
  });

  test('public key is 65 bytes (P-256 uncompressed)', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const length = await page.evaluate(async () => {
      const kp = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        ['deriveKey']
      );
      const raw = await crypto.subtle.exportKey('raw', kp.publicKey);
      return new Uint8Array(raw).length;
    });
    expect(length).toBe(65);
  });

  test('public key starts with 0x04 (uncompressed point format)', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const firstByte = await page.evaluate(async () => {
      const kp = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        ['deriveKey']
      );
      const raw = await crypto.subtle.exportKey('raw', kp.publicKey);
      return new Uint8Array(raw)[0];
    });
    expect(firstByte).toBe(0x04);
  });

  test('different key pairs produce different public keys', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const result = await page.evaluate(async () => {
      const params = { name: 'ECDH', namedCurve: 'P-256' };
      const kp1 = await crypto.subtle.generateKey(params, false, ['deriveKey']);
      const kp2 = await crypto.subtle.generateKey(params, false, ['deriveKey']);
      const raw1 = Array.from(new Uint8Array(await crypto.subtle.exportKey('raw', kp1.publicKey)));
      const raw2 = Array.from(new Uint8Array(await crypto.subtle.exportKey('raw', kp2.publicKey)));
      return { different: JSON.stringify(raw1) !== JSON.stringify(raw2) };
    });
    expect(result.different).toBe(true);
  });

  test('key export format is an array of numbers 0-255', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const result = await page.evaluate(async () => {
      const kp = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        ['deriveKey']
      );
      const raw = await crypto.subtle.exportKey('raw', kp.publicKey);
      const arr = Array.from(new Uint8Array(raw));
      const allValid = arr.every(b => typeof b === 'number' && b >= 0 && b <= 255);
      return { isArray: Array.isArray(arr), allValid, length: arr.length };
    });
    expect(result.isArray).toBe(true);
    expect(result.allValid).toBe(true);
    expect(result.length).toBe(65);
  });
});

test.describe('Shared Secret Derivation', () => {
  test('shared secret is symmetric (Alice→Bob = Bob→Alice)', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const result = await page.evaluate(async () => {
      const params = { name: 'ECDH', namedCurve: 'P-256' };
      const aesParams = { name: 'AES-GCM', length: 256 };
      const alice = await crypto.subtle.generateKey(params, false, ['deriveKey']);
      const bob = await crypto.subtle.generateKey(params, false, ['deriveKey']);

      const abKey = await crypto.subtle.deriveKey(
        { name: 'ECDH', public: bob.publicKey }, alice.privateKey,
        aesParams, true, ['encrypt', 'decrypt']
      );
      const baKey = await crypto.subtle.deriveKey(
        { name: 'ECDH', public: alice.publicKey }, bob.privateKey,
        aesParams, true, ['encrypt', 'decrypt']
      );

      const abRaw = Array.from(new Uint8Array(await crypto.subtle.exportKey('raw', abKey)));
      const baRaw = Array.from(new Uint8Array(await crypto.subtle.exportKey('raw', baKey)));
      return { match: JSON.stringify(abRaw) === JSON.stringify(baRaw) };
    });
    expect(result.match).toBe(true);
  });

  test('key derivation is deterministic (same key pair → same shared key)', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const result = await page.evaluate(async () => {
      const params = { name: 'ECDH', namedCurve: 'P-256' };
      const aesParams = { name: 'AES-GCM', length: 256 };
      const alice = await crypto.subtle.generateKey(params, false, ['deriveKey']);
      const bob = await crypto.subtle.generateKey(params, false, ['deriveKey']);

      const key1 = await crypto.subtle.deriveKey(
        { name: 'ECDH', public: bob.publicKey }, alice.privateKey,
        aesParams, true, ['encrypt', 'decrypt']
      );
      const key2 = await crypto.subtle.deriveKey(
        { name: 'ECDH', public: bob.publicKey }, alice.privateKey,
        aesParams, true, ['encrypt', 'decrypt']
      );

      const raw1 = Array.from(new Uint8Array(await crypto.subtle.exportKey('raw', key1)));
      const raw2 = Array.from(new Uint8Array(await crypto.subtle.exportKey('raw', key2)));
      return { match: JSON.stringify(raw1) === JSON.stringify(raw2) };
    });
    expect(result.match).toBe(true);
  });

  test('three parties: Alice-Bob key ≠ Alice-Charlie key', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const result = await page.evaluate(async () => {
      const params = { name: 'ECDH', namedCurve: 'P-256' };
      const aesParams = { name: 'AES-GCM', length: 256 };
      const alice = await crypto.subtle.generateKey(params, false, ['deriveKey']);
      const bob = await crypto.subtle.generateKey(params, false, ['deriveKey']);
      const charlie = await crypto.subtle.generateKey(params, false, ['deriveKey']);

      const abKey = await crypto.subtle.deriveKey(
        { name: 'ECDH', public: bob.publicKey }, alice.privateKey,
        aesParams, true, ['encrypt', 'decrypt']
      );
      const acKey = await crypto.subtle.deriveKey(
        { name: 'ECDH', public: charlie.publicKey }, alice.privateKey,
        aesParams, true, ['encrypt', 'decrypt']
      );

      const abRaw = Array.from(new Uint8Array(await crypto.subtle.exportKey('raw', abKey)));
      const acRaw = Array.from(new Uint8Array(await crypto.subtle.exportKey('raw', acKey)));
      return { different: JSON.stringify(abRaw) !== JSON.stringify(acRaw) };
    });
    expect(result.different).toBe(true);
  });
});

test.describe('AES-GCM Encryption Properties', () => {
  test('AES-GCM IV is exactly 12 bytes', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const length = await page.evaluate(() => {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      return iv.length;
    });
    expect(length).toBe(12);
  });

  test('ciphertext is longer than plaintext (includes auth tag)', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const result = await page.evaluate(async () => {
      const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
      );
      const plaintext = 'Hello world';
      const encoded = new TextEncoder().encode(plaintext);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
      return {
        plaintextLength: encoded.length,
        ciphertextLength: new Uint8Array(ct).length,
      };
    });
    expect(result.ciphertextLength).toBeGreaterThan(result.plaintextLength);
  });

  test('AES-GCM auth tag is 16 bytes (ciphertext = plaintext + 16)', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const result = await page.evaluate(async () => {
      const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
      );
      const plaintext = 'Test message for auth tag';
      const encoded = new TextEncoder().encode(plaintext);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
      return {
        plaintextLength: encoded.length,
        ciphertextLength: new Uint8Array(ct).length,
      };
    });
    expect(result.ciphertextLength).toBe(result.plaintextLength + 16);
  });

  test('multiple encryptions of same plaintext produce different IVs', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const result = await page.evaluate(async () => {
      const ivs = [];
      for (let i = 0; i < 5; i++) {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        ivs.push(JSON.stringify(Array.from(iv)));
      }
      return { allUnique: new Set(ivs).size === ivs.length };
    });
    expect(result.allUnique).toBe(true);
  });

  test('multiple encryptions of same plaintext produce different ciphertexts', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const result = await page.evaluate(async () => {
      const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
      );
      const plaintext = new TextEncoder().encode('Same message every time');
      const ciphertexts = [];
      for (let i = 0; i < 5; i++) {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
        ciphertexts.push(JSON.stringify(Array.from(new Uint8Array(ct))));
      }
      return { allUnique: new Set(ciphertexts).size === ciphertexts.length };
    });
    expect(result.allUnique).toBe(true);
  });

  test('different plaintexts produce different ciphertexts even with same key', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const result = await page.evaluate(async () => {
      const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
      );
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct1 = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv }, key, new TextEncoder().encode('Message A')
      );
      const iv2 = crypto.getRandomValues(new Uint8Array(12));
      const ct2 = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv2 }, key, new TextEncoder().encode('Message B')
      );
      const a = JSON.stringify(Array.from(new Uint8Array(ct1)));
      const b = JSON.stringify(Array.from(new Uint8Array(ct2)));
      return { different: a !== b };
    });
    expect(result.different).toBe(true);
  });
});

test.describe('Encrypt / Decrypt Roundtrip', () => {
  test('empty string can be encrypted and decrypted', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const result = await page.evaluate(async () => {
      const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
      );
      const plaintext = '';
      const encoded = new TextEncoder().encode(plaintext);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
      return { decrypted: new TextDecoder().decode(decrypted) };
    });
    expect(result.decrypted).toBe('');
  });

  test('very long message (10KB) can be encrypted and decrypted', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const result = await page.evaluate(async () => {
      const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
      );
      const plaintext = 'A'.repeat(10 * 1024);
      const encoded = new TextEncoder().encode(plaintext);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
      const result = new TextDecoder().decode(decrypted);
      return { match: result === plaintext, length: result.length };
    });
    expect(result.match).toBe(true);
    expect(result.length).toBe(10 * 1024);
  });

  test('binary-like content (null bytes, high unicode) survives encrypt/decrypt', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const result = await page.evaluate(async () => {
      const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
      );
      const plaintext = '\x00\x01\x02\xff 🔐 你好 مرحبا \u0000\uFFFF';
      const encoded = new TextEncoder().encode(plaintext);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
      return { match: new TextDecoder().decode(decrypted) === plaintext };
    });
    expect(result.match).toBe(true);
  });

  test('cross-direction: Alice encrypts with AB-key, Bob decrypts with BA-key', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const result = await page.evaluate(async () => {
      const params = { name: 'ECDH', namedCurve: 'P-256' };
      const aesParams = { name: 'AES-GCM', length: 256 };
      const alice = await crypto.subtle.generateKey(params, false, ['deriveKey']);
      const bob = await crypto.subtle.generateKey(params, false, ['deriveKey']);

      const aliceKey = await crypto.subtle.deriveKey(
        { name: 'ECDH', public: bob.publicKey }, alice.privateKey,
        aesParams, false, ['encrypt', 'decrypt']
      );
      const bobKey = await crypto.subtle.deriveKey(
        { name: 'ECDH', public: alice.publicKey }, bob.privateKey,
        aesParams, false, ['encrypt', 'decrypt']
      );

      const plaintext = 'Secret from Alice to Bob';
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encoded = new TextEncoder().encode(plaintext);
      const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aliceKey, encoded);
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, bobKey, ct);
      return { decrypted: new TextDecoder().decode(decrypted) };
    });
    expect(result.decrypted).toBe('Secret from Alice to Bob');
  });

  test('encrypt with one key, export/import key, decrypt with re-derived key', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const result = await page.evaluate(async () => {
      const params = { name: 'ECDH', namedCurve: 'P-256' };
      const aesParams = { name: 'AES-GCM', length: 256 };
      const alice = await crypto.subtle.generateKey(params, false, ['deriveKey']);
      const bob = await crypto.subtle.generateKey(params, false, ['deriveKey']);

      // Alice derives key and encrypts
      const key1 = await crypto.subtle.deriveKey(
        { name: 'ECDH', public: bob.publicKey }, alice.privateKey,
        aesParams, false, ['encrypt', 'decrypt']
      );
      const plaintext = 'Roundtrip with re-derived key';
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv }, key1, new TextEncoder().encode(plaintext)
      );

      // Export Alice's public key and re-import
      const exported = Array.from(new Uint8Array(await crypto.subtle.exportKey('raw', alice.publicKey)));
      const reimported = await crypto.subtle.importKey('raw', new Uint8Array(exported), params, true, []);

      // Bob derives key using re-imported Alice key
      const key2 = await crypto.subtle.deriveKey(
        { name: 'ECDH', public: reimported }, bob.privateKey,
        aesParams, false, ['encrypt', 'decrypt']
      );

      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key2, ct);
      return { decrypted: new TextDecoder().decode(decrypted) };
    });
    expect(result.decrypted).toBe('Roundtrip with re-derived key');
  });

  test('large number of sequential encrypt/decrypt operations (50) all succeed', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const result = await page.evaluate(async () => {
      const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
      );
      let allOk = true;
      for (let i = 0; i < 50; i++) {
        const msg = `Message number ${i}`;
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ct = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv }, key, new TextEncoder().encode(msg)
        );
        const decrypted = new TextDecoder().decode(
          await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
        );
        if (decrypted !== msg) { allOk = false; break; }
      }
      return { allOk };
    });
    expect(result.allOk).toBe(true);
  });

  test('concurrent encrypt operations do not interfere', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const result = await page.evaluate(async () => {
      const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
      );
      const messages = Array.from({ length: 20 }, (_, i) => `Concurrent msg ${i}`);
      const encryptPromises = messages.map(async (msg) => {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ct = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv }, key, new TextEncoder().encode(msg)
        );
        return { iv, ct, original: msg };
      });

      const encrypted = await Promise.all(encryptPromises);

      const decryptPromises = encrypted.map(async ({ iv, ct, original }) => {
        const decrypted = new TextDecoder().decode(
          await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
        );
        return decrypted === original;
      });

      const results = await Promise.all(decryptPromises);
      return { allOk: results.every(Boolean) };
    });
    expect(result.allOk).toBe(true);
  });
});

test.describe('Tamper Detection', () => {
  test('tampered ciphertext fails decryption (flip a bit)', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const result = await page.evaluate(async () => {
      const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
      );
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv }, key, new TextEncoder().encode('Tamper test')
      );
      const tampered = new Uint8Array(ct);
      tampered[0] ^= 0xff; // flip all bits in first byte
      try {
        await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, tampered);
        return { failed: false };
      } catch {
        return { failed: true };
      }
    });
    expect(result.failed).toBe(true);
  });

  test('tampered IV fails decryption', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const result = await page.evaluate(async () => {
      const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
      );
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv }, key, new TextEncoder().encode('IV tamper test')
      );
      const wrongIv = new Uint8Array(12);
      wrongIv.set(iv);
      wrongIv[0] ^= 0xff;
      try {
        await crypto.subtle.decrypt({ name: 'AES-GCM', iv: wrongIv }, key, ct);
        return { failed: false };
      } catch {
        return { failed: true };
      }
    });
    expect(result.failed).toBe(true);
  });

  test('truncated ciphertext fails decryption', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const result = await page.evaluate(async () => {
      const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
      );
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv }, key, new TextEncoder().encode('Truncation test')
      );
      const truncated = new Uint8Array(ct).slice(0, 5);
      try {
        await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, truncated);
        return { failed: false };
      } catch {
        return { failed: true };
      }
    });
    expect(result.failed).toBe(true);
  });

  test('GCM authentication: ciphertext integrity prevents silent modification', async ({ page }) => {
    await page.goto('/' + PEER_PARAMS);
    const result = await page.evaluate(async () => {
      const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
      );
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv }, key, new TextEncoder().encode('Integrity check')
      );
      // Modify the last byte of the auth tag
      const modified = new Uint8Array(ct);
      modified[modified.length - 1] ^= 0x01;
      try {
        await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, modified);
        return { failed: false };
      } catch {
        return { failed: true };
      }
    });
    expect(result.failed).toBe(true);
  });
});
