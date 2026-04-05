/**
 * Thin wrapper around fetch that attaches the JWT and base URL.
 * Usage: api.get('/api/documents'), api.post('/api/auth/login', body), etc.
 */
function getToken() {
  return localStorage.getItem('token');
}

function authHeaders(extra = {}) {
  const token = getToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function request(method, path, body, isFormData = false) {
  const headers = isFormData
    ? authHeaders()
    : authHeaders({ 'Content-Type': 'application/json' });

  const res = await fetch(path, {
    method,
    headers,
    body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data.error) message = data.error;
    } catch {}
    throw new Error(message);
  }

  // Some responses (DELETE) may have no body
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  return res;
}

const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  delete: (path) => request('DELETE', path),
  upload: (path, formData) => request('POST', path, formData, true),
};

export default api;
