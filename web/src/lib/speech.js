// Bacakan teks dengan suara (Web Speech API, bahasa Indonesia).
export const bisaBicara = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

let pilihan = null;
function suaraIndonesia() {
  if (pilihan) return pilihan;
  const semua = window.speechSynthesis.getVoices();
  pilihan = semua.find((v) => v.lang?.toLowerCase().startsWith('id')) || null;
  return pilihan;
}

export function bicara(teks, { onEnd } = {}) {
  if (!bisaBicara() || !teks) return false;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(teks);
  u.lang = 'id-ID';
  const v = suaraIndonesia();
  if (v) u.voice = v;
  u.rate = 1;
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  window.speechSynthesis.speak(u);
  return true;
}

export function diam() {
  if (bisaBicara()) window.speechSynthesis.cancel();
}
