# Edge Proxy Server for Chrome/Chromebook Users

This proxy lets you browse/search sites as Microsoft Edge, minimizing Chrome plugin interference. Designed for Chromebooks, Chrome-dominant setups, and users needing alternate browsing.

## Quick Start

**1. Install Node.js (enable Linux in Chromebook if needed):**
```bash
sudo apt install nodejs npm
```

**2. Install dependencies:**
```bash
npm install express request
```

**3. Run the server:**
```bash
node edge-proxy/proxy-server.js
```

**4. Open `edge-proxy/frontend.html` in Chrome.**
- Enter any URL, and it loads via the Edge-spoofed proxy.

## Notes & Limitations
- Only HTTP(S) URLs are supported.
- Content may be slightly altered (images/scripts) due to proxying.
- For best results, use in Incognito/Guest mode.
- To deploy, move the files to any Node.js host.

## Troubleshooting
- If sites don’t load, check your URL and proxy server logs.
- Chromebook: Linux/Node.js must be enabled.
- Some pages block proxies—try alternate URLs or adjust proxy 'User-Agent'.

## License
MIT
