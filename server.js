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
- No introduction, start solving immediately`;

// Try models in order until one works
const FREE_MODELS = [
  'mistralai/mistral-7b-instruct:free',
  'google/gemma-2-9b-it:free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'microsoft/phi-3-mini-128k-instruct:free'
];

function callOpenRouter(question, res) {
  const model = FREE_MODELS[0];
  console.log('Calling model:', model);
  console.log('API_KEY present:', API_KEY ? 'YES (' + API_KEY.slice(0,12) + '...)' : 'NO - MISSING!');

  const payload = JSON.stringify({
    model: model,
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
      'HTTP-Referer': 'https://statistic-and-probability-2.onrender.com',
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
    console.log('OpenRouter status:', apiRes.statusCode);
    let buffer = '';
    let fullResponse = '';

    apiRes.on('data', chunk => {
      const str = chunk.toString();
      buffer += str;
      fullResponse += str;

      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        res.write(line + '\n');
      }
    });

    apiRes.on('end', () => {
      if (buffer) res.write(buffer + '\n');
      // Log first 300 chars of response for debugging
      console.log('Response preview:', fullResponse.slice(0, 300));
      res.end();
    });
  });

  apiReq.on('error', e => {
    console.error('Request error:', e.message);
    res.write('data: {"choices":[{"delta":{"content":"Алдаа: ' + e.message + '"}}]}\n\n');
    res.write('data: [DONE]\n\n');
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
      res.writeHead(500); res.end('Error: ' + e.message);
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/api/solve') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      let question = '';
      try { question = JSON.parse(body).question || ''; } catch(e) {
        console.error('JSON parse error:', e.message);
      }
      if (!question.trim()) { res.writeHead(400); res.end('Missing question'); return; }
      console.log('Question:', question.slice(0, 80));
      callOpenRouter(question, res);
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/ping') {
    res.writeHead(200); res.end('pong');
    return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => console.log('StatSolver running on port ' + PORT));
