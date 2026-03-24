# P2P Chat

A serverless, peer-to-peer encrypted chat application. No backend, no accounts, no data collection — just open, connect, and chat.

[Live Demo](https://jloures.github.io/p2pmessenger/)

## Features

- **Peer-to-peer** — direct WebRTC connection between browsers via [PeerJS](https://peerjs.com/)
- **E2E encrypted** — ECDH P-256 key exchange + AES-256-GCM, using the browser's native [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- **Zero setup** — auto-assigned peer ID, no accounts or configuration
- **QR code sharing** — generate a QR code that auto-connects when scanned
- **Single file** — one HTML file with embedded CSS/JS, no build step
- **Mobile friendly** — responsive layout, safe area insets, virtual keyboard handling
- **Typing indicator** — see when the other person is typing
- **No persistence** — nothing stored in localStorage, cookies, or on any server

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

## Security model

- **Key exchange**: Each peer generates an ephemeral ECDH P-256 key pair on page load. Public keys are exchanged over the PeerJS data channel on connection.
- **Message encryption**: A shared AES-256-GCM key is derived via ECDH. Every message is encrypted with a random 12-byte IV before sending.
- **Transport**: WebRTC data channels are encrypted at the transport layer (DTLS). Application-layer encryption adds protection against compromised signaling servers.
- **No persistence**: Keys exist only in memory and are discarded on page close or disconnect.
