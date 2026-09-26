const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export async function sendEnquiry(data) {
  const res = await fetch(`${API_URL}/api/enquiries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Something went wrong');
  return body;
}
