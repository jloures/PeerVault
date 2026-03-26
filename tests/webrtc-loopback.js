/**
 * Playwright init script that patches RTCPeerConnection.prototype.addIceCandidate
 * to also inject 127.0.0.1 loopback ICE candidates. This fixes WebRTC connectivity
 * when the local network interface is a VPN tunnel that doesn't support local UDP.
 *
 * Minimal and non-invasive: only touches addIceCandidate, leaves constructor intact.
 */
(function () {
  const origAddIceCandidate = RTCPeerConnection.prototype.addIceCandidate;
  const hostRegex = /^candidate:\d+ 1 udp \d+ ([\d.]+) (\d+) typ host/;

  RTCPeerConnection.prototype.addIceCandidate = function (candidate) {
    const result = origAddIceCandidate.call(this, candidate);

    // If this is a host candidate with a non-loopback IP, also add a loopback variant
    if (candidate && candidate.candidate) {
      const match = candidate.candidate.match(hostRegex);
      if (match && match[1] !== '127.0.0.1') {
        const loopback = candidate.candidate.replace(match[1], '127.0.0.1');
        origAddIceCandidate.call(this, new RTCIceCandidate({
          candidate: loopback,
          sdpMid: candidate.sdpMid,
          sdpMLineIndex: candidate.sdpMLineIndex,
          usernameFragment: candidate.usernameFragment,
        })).catch(() => {}); // Silently ignore if it fails
      }
    }

    return result;
  };
})();
