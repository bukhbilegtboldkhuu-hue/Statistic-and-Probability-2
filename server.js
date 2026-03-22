const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.OPENROUTER_API_KEY || '';
const PORT = process.env.PORT || 3000;

const SYSTEM = `You are a statistics solver. You MUST reply ONLY in Mongolian language. Never use Russian, English or any other language.

Format your response like this:
📌 ТОМЬЁО: [formula in plain text, no LaTeX, no $$ signs]
🔢 ТООЦООЛОЛ: [step by step calculation]
✅ ХАРИУЛТ: [final answer]

RULES:
- Write ONLY in Mongolian language
- Do NOT use LaTeX (no $$, no \\boxed, no \\cup)
- Use plain text: P(A∪B), P(A∩B), μ, σ
- Give exact numerical answers
- Start solving immediately`;

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // Serve index.html
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  // AI endpoint with streaming
  if (req.method === 'POST' && req.url === '/api/solve') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      let question;
      try { question = JSON.parse(body).question; } catch { question = ''; }
      if (!question) { res.writeHead(400); res.end('Bad request'); return; }

      const payload = JSON.stringify({
        model: 'openrouter/auto',
        stream: true,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: question }
        ],
        max_tokens: 1500,
        temperature: 0.1
      });

      const options = {
        hostname: 'openrouter.ai',
        path: '/api/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + API_KEY,
          'HTTP-Referer': 'https://statsolver.onrender.com',
          'X-Title': 'StatSolver'
        }
      };

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });

      const apiReq = https.request(options, apiRes => {
        apiRes.on('data', chunk => res.write(chunk));
        apiRes.on('end', () => res.end());
      });
      apiReq.on('error', e => {
        res.write(`data: {"error":"${e.message}"}\n\n`);
        res.end();
      });
      apiReq.write(payload);
      apiReq.end();
    });
    return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => console.log(`StatSolver running on port ${PORT}`));
