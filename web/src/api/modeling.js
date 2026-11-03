const API = import.meta.env.VITE_API_URL;

async function request(path, options) {
  if (!API) throw new Error('Alamat backend belum dikonfigurasi.');
  const response = await fetch(`${API}${path}`, options);
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.detail || 'Backend KOZY gagal memproses permintaan.');
  return data;
}

export const getModelingSummary = () => request('/modeling/summary');

const post = (path, input) => request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

export const classifyPrice = (input) => post('/modeling/segment', input);
export const analyzePriceGap = (input) => post('/modeling/price-gap', input);