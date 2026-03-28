# PeerVault

A serverless, peer-to-peer encrypted chat application. No backend, no accounts, no data collection — just open, connect, and chat.

[Live Demo](https://jloures.github.io/PeerVault/)

## Features

- **Peer-to-peer** — direct WebRTC connection between browsers via [PeerJS](https://peerjs.com/)
- **E2E encrypted** — ECDH P-256 key exchange + AES-256-GCM, using the browser's native [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- **Multi-room** — chat with multiple peers simultaneously, each with independent encryption
- **Zero setup** — auto-assigned peer ID, no accounts or configuration
- **QR code sharing** — generate a QR code that auto-connects when scanned
- **Single file** — one HTML file with embedded CSS/JS, no build step
- **Native mobile apps** — iOS and Android via [Capacitor](https://capacitorjs.com/), with native share, clipboard, and haptics
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

## Mobile apps (iOS & Android)

PeerVault runs natively on iOS and Android via [Capacitor](https://capacitorjs.com/). The same `index.html` is wrapped in a native WebView with access to platform APIs (share sheet, clipboard, haptics, status bar).

### Prerequisites

- **iOS**: Xcode 15+ and CocoaPods (`sudo gem install cocoapods`)
- **Android**: Android Studio with SDK 22+

### Build and run

```bash
# Sync web assets to native projects
npm run cap:sync

# Open in Xcode (build/run from there)
npm run cap:ios

# Open in Android Studio (build/run from there)
npm run cap:android

# Run directly on a connected device/simulator
npm run cap:run:ios
npm run cap:run:android
```

### Native features

When running as a native app, PeerVault automatically uses:

- **Native share sheet** — share your Peer ID via any installed app
- **Native clipboard** — copy Peer ID with haptic feedback
- **Status bar** — dark style matching the app theme
- **Android back button** — closes sidebar or navigates back
- **Splash screen** — dark themed launch screen

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
| Mobile | [Capacitor](https://capacitorjs.com/) (iOS + Android native shell) |
| Hosting | Any static file server (GitHub Pages, Netlify, etc.) |

## Encryption

All message content (chat text, display names) is end-to-end encrypted. The encryption runs entirely in the browser using the [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) — no custom crypto, no external libraries.

### Key exchange (ECDH P-256)

Each chat room generates its own ephemeral ECDH key pair using the P-256 (secp256r1) curve:

```
crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey'])
```

When two peers connect, each side sends its ECDH public key **signed with its persistent identity key** over the WebRTC data channel:

```
Alice                          Bob
  |                              |
  |--- { type: 'key-exchange',  --->
  |      publicKey: [bytes],     |
  |      identityKey: [bytes],   |
  |      signature: [bytes] }    |
  |                              |
  <--- { type: 'key-exchange',  ---|
  |      publicKey: [bytes],     |
  |      identityKey: [bytes],   |
  |      signature: [bytes] }    |
  |                              |
```

Both sides verify the signature, then derive the same shared secret using their own private key and the remote public key. This is a standard [Elliptic Curve Diffie-Hellman](https://en.wikipedia.org/wiki/Elliptic-curve_Diffie%E2%80%93Hellman) exchange — neither side ever sends their private key.

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
| Identity public keys | No | Used for authentication — safe to share |
| Typing indicators | No | Contain no content, only signal activity |
| Peer IDs | No | Required by the signaling server to route the initial connection |

### Transport layers

There are two independent encryption layers:

1. **Application layer (this app)**: ECDH + AES-256-GCM as described above. Protects against a compromised signaling server or any intermediary that can observe the WebRTC data channel contents.

2. **Transport layer (WebRTC)**: All WebRTC data channels are encrypted with DTLS (Datagram TLS). This is mandatory and handled by the browser — it cannot be disabled.

The application-layer encryption is the important one: even if someone intercepts the DTLS-encrypted WebRTC traffic and manages to decrypt it, they still only see AES-256-GCM ciphertext.

### Identity keys and authentication

Each device generates a persistent signing key pair (Ed25519, or ECDSA P-256 as fallback) on first launch. This identity key is used to **sign** the ephemeral ECDH public key during key exchange, preventing man-in-the-middle attacks.

Identity verification uses trust-on-first-use (TOFU): the first time you connect to a peer, their identity key is stored. On subsequent connections, PeerVault verifies it hasn't changed. If it has, a warning is shown.

Users can also verify identity out-of-band via **safety numbers** — a 12-character hex code derived from both identity keys. If both peers see the same safety number, no MITM is occurring.

### Message sequence numbers

Every encrypted message includes a sequence number inside the encrypted envelope. Both sides maintain send and receive counters that reset on each new connection. Out-of-order or duplicate messages are detected and dropped, preventing replay attacks.

### Subresource integrity

CDN-loaded scripts (PeerJS, qrcode-generator) use [Subresource Integrity](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity) (SRI) hashes to ensure the browser rejects tampered payloads.

### Threat model

- **Signaling server**: Sees peer IDs and connection metadata, but never sees message content or encryption keys. Even a fully compromised PeerJS server cannot read messages. A MITM attack via the signaling server is detectable via safety number verification and triggers an identity change warning on subsequent connections (TOFU).
- **Network observer**: Sees encrypted DTLS packets. Cannot determine message content.
- **Key lifetime**: ECDH key pairs are ephemeral — generated per room, per session. Disconnecting or closing the page destroys session keys. Reconnecting performs a fresh key exchange. Identity keys persist across sessions.
- **Forward secrecy**: Each connection uses a new ephemeral key pair, so compromising one session's keys does not compromise past or future sessions.
- **Authentication**: Identity keys authenticate each peer during key exchange (TOFU model). Safety numbers provide out-of-band verification. Connections to peers without identity keys (older versions) show an "Unverified" badge.
- **Replay protection**: Message sequence numbers prevent replay and reorder attacks within a session.
