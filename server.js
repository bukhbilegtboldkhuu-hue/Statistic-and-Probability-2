const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.OPENROUTER_API_KEY || '';
const PORT = process.env.PORT || 3000;

const SYSTEM = `You are a statistics and math solver. You MUST reply ONLY in Mongolian language. Never use Russian or English.

Format every answer like this:
📌 ТОМЬЁО: [formula in plain text]
🔢 ТООЦООЛОЛ: [step by step]
✅ ХАРИУЛТ: [final answer]

Rules:
- Mongolian language ONLY
- No LaTeX, no $$, no \\boxed, no \\frac
- Use plain symbols: P(A∪B), μ, σ, n!
- Give exact numbers
- No introduction, start solving immediately`;

function callOpenRouter(question, res) {
  const payload = JSON.stringify({
    model: 'mistralai/mistral-7b-instruct:free',
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
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  const apiReq = https.request(options, apiRes => {
    let buffer = '';
    apiRes.on('data', chunk => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line
      for (const line of lines) {
        res.write(line + '\n');
      }
    });
    apiRes.on('end', () => {
      if (buffer) res.write(buffer + '\n');
      res.end();
    });
  });

  apiReq.on('error', e => {
    res.write('data: {"error":"' + e.message + '"}\n\n');
    res.end();
  });

  apiReq.write(payload);
  apiReq.end();
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    try {
      const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch(e) {
      res.writeHead(500); res.end('Error loading page');
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/api/solve') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      let question = '';
      try { question = JSON.parse(body).question || ''; } catch {}
      if (!question.trim()) { res.writeHead(400); res.end('Missing question'); return; }
      callOpenRouter(question, res);
    });
    return;
  }

  // Health check for uptime pings
  if (req.method === 'GET' && req.url === '/ping') {
    res.writeHead(200); res.end('pong');
    return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => console.log('StatSolver running on port ' + PORT));
