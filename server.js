const express = require('express');
const axios = require('axios');
const { URL } = require('url');
const path = require('path');

const app = express();
const PORT = 8080;

// Serve the frontend
app.use(express.static('public'));

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Main proxy endpoint
app.get('/proxy', async (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).send('Missing URL parameter');
  }

  try {
    // Validate URL
    const url = new URL(targetUrl);
    
    // Fetch the target page
    const response = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      responseType: 'arraybuffer',
      maxRedirects: 5,
      validateStatus: function (status) {
        return status < 500; // Accept all responses except 5xx errors
      }
    });

    const contentType = response.headers['content-type'] || '';
    let data = response.data;

    // Rewrite HTML content to proxy all links
    if (contentType.includes('text/html')) {
      let html = data.toString('utf-8');
      html = rewriteHTML(html, targetUrl, req.protocol + '://' + req.get('host'));
      data = Buffer.from(html, 'utf-8');
    }

    // Rewrite CSS content
    if (contentType.includes('text/css')) {
      let css = data.toString('utf-8');
      css = rewriteCSS(css, targetUrl, req.protocol + '://' + req.get('host'));
      data = Buffer.from(css, 'utf-8');
    }

    // Set response headers
    res.set({
      'Content-Type': response.headers['content-type'],
      'Cache-Control': response.headers['cache-control'] || 'no-cache',
    });

    // Remove security headers that would block the proxy
    const blockedHeaders = [
      'content-security-policy',
      'x-frame-options',
      'strict-transport-security',
    ];

    res.send(data);

  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(500).send(`Proxy Error: ${error.message}`);
  }
});

// Proxy for other resources (images, scripts, etc.)
app.get('/resource', async (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).send('Missing URL parameter');
  }

  try {
    const response = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Referer': targetUrl,
      },
      responseType: 'arraybuffer',
      maxRedirects: 5,
    });

    res.set({
      'Content-Type': response.headers['content-type'],
      'Cache-Control': response.headers['cache-control'] || 'public, max-age=3600',
    });

    res.send(response.data);

  } catch (error) {
    console.error('Resource error:', error.message);
    res.status(404).send('Resource not found');
  }
});

// Rewrite HTML to proxy all URLs
function rewriteHTML(html, targetUrl, proxyUrl) {
  const target = new URL(targetUrl);
  const baseUrl = `${target.protocol}//${target.host}`;

  // Rewrite absolute URLs (http:// and https://)
  html = html.replace(/(href|src|action)=["'](https?:\/\/[^"']+)["']/gi, (match, attr, url) => {
    return `${attr}="${proxyUrl}/proxy?url=${encodeURIComponent(url)}"`;
  });

  // Rewrite protocol-relative URLs (//)
  html = html.replace(/(href|src|action)=["']\/\/([^"']+)["']/gi, (match, attr, url) => {
    return `${attr}="${proxyUrl}/proxy?url=${encodeURIComponent('https://' + url)}"`;
  });

  // Rewrite root-relative URLs (/)
  html = html.replace(/(href|src|action)=["']\/([^/][^"']*)["']/gi, (match, attr, path) => {
    const fullUrl = `${baseUrl}/${path}`;
    return `${attr}="${proxyUrl}/proxy?url=${encodeURIComponent(fullUrl)}"`;
  });

  // Rewrite relative URLs
  html = html.replace(/(href|src|action)=["'](?!https?:\/\/|\/\/|#|data:)([^"']+)["']/gi, (match, attr, path) => {
    if (path.startsWith('javascript:') || path.startsWith('mailto:')) {
      return match;
    }
    const fullUrl = new URL(path, targetUrl).href;
    return `${attr}="${proxyUrl}/proxy?url=${encodeURIComponent(fullUrl)}"`;
  });

  // Add base tag
  html = html.replace(/<head>/i, `<head><base href="${targetUrl}">`);

  // Rewrite window.location and other JavaScript navigation
  html = html.replace(/window\.location\s*=\s*["']([^"']+)["']/g, (match, url) => {
    const fullUrl = new URL(url, targetUrl).href;
    return `window.location="${proxyUrl}/proxy?url=${encodeURIComponent(fullUrl)}"`;
  });

  return html;
}

// Rewrite CSS URLs
function rewriteCSS(css, targetUrl, proxyUrl) {
  const target = new URL(targetUrl);
  const baseUrl = `${target.protocol}//${target.host}`;

  // Rewrite url() in CSS
  css = css.replace(/url\(["']?([^"')]+)["']?\)/gi, (match, url) => {
    if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
      if (url.startsWith('http')) {
        return `url("${proxyUrl}/resource?url=${encodeURIComponent(url)}")`;
      }
      return match;
    }
    
    const fullUrl = new URL(url, targetUrl).href;
    return `url("${proxyUrl}/resource?url=${encodeURIComponent(fullUrl)}")`;
  });

  return css;
}

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║        🔒 PRIVATE WEB PROXY SERVER RUNNING 🔒              ║
║                                                            ║
║  ✓ No tracking                                             ║
║  ✓ No external services                                    ║
║  ✓ 100% local control                                      ║
║                                                            ║
║  Open in your browser:                                     ║
║  👉 http://localhost:${PORT}                                   ║
║                                                            ║
║  Press Ctrl+C to stop                                      ║
║                                                            ║
╔════════════════════════════════════════════════════════════╗
  `);
});
