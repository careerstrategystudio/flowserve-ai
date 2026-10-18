// Cliente mínimo de la API de Retell AI.
import { env } from './util.js';

const API = 'https://api.retellai.com';

async function r(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method, headers: { Authorization: `Bearer ${env('RETELL_API_KEY')}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Retell ${method} ${path} ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

export const retell = {
  createLlm: (body) => r('POST', '/create-retell-llm', body),
  updateLlm: (id, body) => r('PATCH', `/update-retell-llm/${id}`, body),
  createAgent: (body) => r('POST', '/create-agent', body),
  updateAgent: (id, body) => r('PATCH', `/update-agent/${id}`, body),
  createPhoneCall: (body) => r('POST', '/v2/create-phone-call', body),
};
