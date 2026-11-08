// Ubah ucapan jadi teks (Web Speech API, bahasa Indonesia).
// Hanya ada di sebagian browser (Chrome, Edge, Safari); tombol mikrofon
// disembunyikan kalau tidak didukung, jadi mengetik tetap jalan utama.
const SR = () => (typeof window === 'undefined' ? null : window.SpeechRecognition || window.webkitSpeechRecognition || null);

export const bisaDengar = () => !!SR();

// onTeks(teks, final) dipanggil berkali-kali selama orang bicara.
// Mengembalikan fungsi untuk berhenti.
export function dengar({ onTeks, onSelesai, onGagal } = {}) {
  const Rec = SR();
  if (!Rec) return () => {};
  const r = new Rec();
  r.lang = 'id-ID';
  r.interimResults = true;
  r.maxAlternatives = 1;
  r.onresult = (e) => {
    const teks = Array.from(e.results)
      .map((x) => x[0].transcript)
      .join('');
    onTeks?.(teks, e.results[e.results.length - 1].isFinal);
  };
  r.onerror = (e) => onGagal?.(e.error);
  r.onend = () => onSelesai?.();
  try {
    r.start();
  } catch {
    onGagal?.('start');
  }
  return () => r.abort();
}
