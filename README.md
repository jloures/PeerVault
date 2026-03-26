# PeerVault

A serverless, peer-to-peer encrypted chat application. No backend, no accounts, no data collection — just open, connect, and chat.

[Live Demo](https://jloures.github.io/peervault/)

## Features

- **Peer-to-peer** — direct WebRTC connection between browsers via [PeerJS](https://peerjs.com/)
- **E2E encrypted** — ECDH P-256 key exchange + AES-256-GCM, using the browser's native [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- **Multi-room** — chat with multiple peers simultaneously, each with independent encryption
- **Zero setup** — auto-assigned peer ID, no accounts or configuration
- **QR code sharing** — generate a QR code that auto-connects when scanned
- **Single file** — one HTML file with embedded CSS/JS, no build step
- **Mobile friendly** — responsive layout, safe area insets, virtual keyboard handling
- **Typing indicator** — see when the other person is typing
- **No persistence** — messages exist only in memory, keys are discarded on disconnect

## How it works

1. Open the page — you get a unique peer ID
2. Share your ID (copy or QR code) with someone
3. They paste your ID and click Connect (or scan the QR)
4. ECDH key exchange establishes a shared AES-256 encryption key
5. All messages are encrypted before sending and decrypted on receipt

The only server involved is PeerJS's free signaling server, which brokers the initial WebRTC handshake. Once connected, all traffic flows directly between browsers. The signaling server never sees message content.

## Running locally

```bash
# Serve the static file
npx serve . -l 3000

# Or just open index.html directly in a browser
open index.html
```

To test peer-to-peer, open the page in two browser tabs.

## Tests

```bash
npm install
npx playwright install --with-deps chromium

# Run all tests
npm test

# Run specific suites
npm run test:app      # Core UI and P2P connection tests
npm run test:crypto   # E2E encryption tests
npm run test:mobile   # Mobile responsiveness tests
npm run test:a11y     # Accessibility audits
```

## Tech stack

| What | How |
|------|-----|
| P2P signaling | [PeerJS](https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js) (CDN) |
| NAT traversal | Google STUN servers |
| Encryption | Web Crypto API (ECDH + AES-GCM) |
| QR codes | [qrcode-generator](https://unpkg.com/qrcode-generator@1.4.4/qrcode.js) (CDN) |
| Testing | [Playwright](https://playwright.dev/) + [axe-core](https://github.com/dequelabs/axe-core) |
| Hosting | Any static file server (GitHub Pages, Netlify, etc.) |

## Encryption

All message content (chat text, display names) is end-to-end encrypted. The encryption runs entirely in the browser using the [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) — no custom crypto, no external libraries.

### Key exchange (ECDH P-256)

Each chat room generates its own ephemeral ECDH key pair using the P-256 (secp256r1) curve:

```
crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey'])
```

When two peers connect, each side sends its raw public key over the WebRTC data channel:

```
Alice                          Bob
  |                              |
  |--- { type: 'key-exchange',  --->
  |      publicKey: [bytes] }    |
  |                              |
  <--- { type: 'key-exchange',  ---|
  |      publicKey: [bytes] }    |
  |                              |
```

Both sides then derive the same shared secret using their own private key and the remote public key. This is a standard [Elliptic Curve Diffie-Hellman](https://en.wikipedia.org/wiki/Elliptic-curve_Diffie%E2%80%93Hellman) exchange — neither side ever sends their private key.

### Session key derivation (AES-256-GCM)

The ECDH shared secret is fed directly into `deriveKey` to produce a 256-bit AES-GCM symmetric key:

```
crypto.subtle.deriveKey(
  { name: 'ECDH', public: remotePublicKey },
  myPrivateKey,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt', 'decrypt']
)
```

This derived key is used for all subsequent encrypted communication within that room. The key is non-extractable (`false` parameter) — it can only be used for encrypt/decrypt operations and cannot be read back by JavaScript.

### Message encryption

Every message is encrypted with AES-256-GCM using a fresh random 12-byte IV:

```
const iv = crypto.getRandomValues(new Uint8Array(12));
const ciphertext = crypto.subtle.encrypt({ name: 'AES-GCM', iv }, sharedKey, plaintext);
```

The encrypted payload sent over the wire contains only:
- `iv` — the 12-byte initialization vector (safe to send in cleartext)
- `ct` — the ciphertext + GCM authentication tag

AES-GCM provides both confidentiality and integrity — any tampering with the ciphertext is detected on decryption.

### What is and isn't encrypted

| Data | Encrypted | Notes |
|------|-----------|-------|
| Chat messages | Yes | AES-256-GCM |
| Display names | Yes | Sent as encrypted control messages after key exchange |
| ECDH public keys | No | Safe by design — public keys are meant to be shared |
| Typing indicators | No | Contain no content, only signal activity |
| Peer IDs | No | Required by the signaling server to route the initial connection |

### Transport layers

There are two independent encryption layers:

1. **Application layer (this app)**: ECDH + AES-256-GCM as described above. Protects against a compromised signaling server or any intermediary that can observe the WebRTC data channel contents.

2. **Transport layer (WebRTC)**: All WebRTC data channels are encrypted with DTLS (Datagram TLS). This is mandatory and handled by the browser — it cannot be disabled.

The application-layer encryption is the important one: even if someone intercepts the DTLS-encrypted WebRTC traffic and manages to decrypt it, they still only see AES-256-GCM ciphertext.

### Threat model

- **Signaling server**: Sees peer IDs and connection metadata, but never sees message content or encryption keys. Even a fully compromised PeerJS server cannot read messages.
- **Network observer**: Sees encrypted DTLS packets. Cannot determine message content.
- **Key lifetime**: Key pairs are ephemeral — generated per room, per session. Disconnecting or closing the page destroys all keys. Reconnecting performs a fresh key exchange.
- **Forward secrecy**: Each connection uses a new ephemeral key pair, so compromising one session's keys does not compromise past or future sessions.
- **No authentication**: The key exchange does not authenticate peer identity. A man-in-the-middle who can intercept the signaling channel could substitute their own public keys. This is a known limitation of unauthenticated ECDH.
