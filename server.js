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
- No LaTeX, no $$, no \\boxed
- Use plain symbols: P(A∪B), μ, σ, n!
- Give exact numbers
- Start solving immediately, no preamble`;

function callOpenRouter(question, res) {
  console.log('API_KEY:', API_KEY ? API_KEY.slice(0,15)+'...' : 'MISSING!');

  const payload = JSON.stringify({
    model: 'deepseek/deepseek-r1:free',
    stream: false,
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
      'Content-Length': Buffer.byteLength(payload),
      'Authorization': 'Bearer ' + API_KEY,
      'HTTP-Referer': 'https://statistic-and-probability-2.onrender.com',
      'X-Title': 'StatSolver'
    }
  };

  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });

  const apiReq = https.request(options, apiRes => {
    console.log('OpenRouter HTTP status:', apiRes.statusCode);
    let data = '';
    apiRes.on('data', chunk => data += chunk);
    apiRes.on('end', () => {
      console.log('Raw response:', data.slice(0, 400));
      try {
        const json = JSON.parse(data);
        if (json.error) {
          console.error('OpenRouter error:', json.error);
          res.end(JSON.stringify({ error: json.error.message || 'OpenRouter алдаа' }));
          return;
        }
        const text = json.choices?.[0]?.message?.content || '';
        console.log('Answer length:', text.length);
        res.end(JSON.stringify({ text }));
      } catch(e) {
        console.error('Parse error:', e.message, data.slice(0,200));
        res.end(JSON.stringify({ error: 'Parse алдаа: ' + e.message }));
      }
    });
  });

  apiReq.on('error', e => {
    console.error('HTTPS error:', e.message);
    res.end(JSON.stringify({ error: 'Сүлжээний алдаа: ' + e.message }));
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
    } catch(e) { res.writeHead(500); res.end('Error: ' + e.message); }
    return;
  }

  if (req.method === 'POST' && req.url === '/api/solve') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      let question = '';
      try { question = JSON.parse(body).question || ''; } catch {}
      if (!question.trim()) { res.writeHead(400); res.end('Missing question'); return; }
      console.log('Question:', question.slice(0, 80));
      callOpenRouter(question, res);
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/ping') {
    res.writeHead(200); res.end('pong'); return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => console.log('StatSolver running on port ' + PORT));
