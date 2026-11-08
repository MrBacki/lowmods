// Netlify Function: leitet Anfragen der LowMods-Seite an NVIDIA, Anthropic und VirusTotal weiter.
// Nötig, weil diese APIs Anfragen direkt aus dem Browser (CORS) blockieren.
// Keys werden nicht gespeichert, nur weitergereicht. Erlaubt sind nur die drei Hosts unten.

const ALLOWED_HOSTS = new Set(['integrate.api.nvidia.com', 'api.anthropic.com', 'www.virustotal.com']);
const FORWARD_HEADERS = new Set(['content-type', 'authorization', 'x-api-key', 'anthropic-version', 'x-apikey']);

exports.handler = async (event) => {
  const target = event.queryStringParameters && event.queryStringParameters.to;
  if (!target) return { statusCode: 400, body: JSON.stringify({ error: 'Parameter "to" fehlt' }) };

  let url;
  try {
    url = new URL(target);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Ungültige URL' }) };
  }
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Host nicht erlaubt' }) };
  }

  const headers = {};
  for (const [k, v] of Object.entries(event.headers || {})) {
    const key = k.toLowerCase();
    if (FORWARD_HEADERS.has(key)) headers[key] = v;
  }

  const method = event.httpMethod || 'GET';
  const init = { method, headers };
  if (method !== 'GET' && method !== 'HEAD' && event.body) {
    init.body = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body;
  }

  try {
    const r = await fetch(url.toString(), init);
    const text = await r.text();
    return {
      statusCode: r.status,
      headers: { 'content-type': r.headers.get('content-type') || 'application/json' },
      body: text
    };
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ error: 'Weiterleitung fehlgeschlagen: ' + (e.message || e) }) };
  }
};
