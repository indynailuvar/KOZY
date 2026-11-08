// Tanda merek KOZY.
//
// Logonya kerangka rumah: atap dengan puncak membulat, cerobong kecil, dan
// pintu melengkung, digambar dengan garis tebal bergradasi biru ke tosca.
// Sudut-sudutnya sengaja membulat supaya terasa hangat, seperti rumah sendiri.
import { useId } from 'react';
import Icon from './Icon.jsx';

export function KozyMark({ size = 30, className = '' }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`kz${id}`} x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3b82f6" />
          <stop offset="1" stopColor="#14b8a6" />
        </linearGradient>
      </defs>
      <g stroke={`url(#kz${id})`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.5 14.5 14.4 6.3a2.5 2.5 0 0 1 3.2 0l9.9 8.2" />
        <path d="M22.5 10.4V6.5" />
        <path d="M8 13.2v10.3a3.5 3.5 0 0 0 3.5 3.5h9a3.5 3.5 0 0 0 3.5-3.5V13.2" />
        <path d="M13 27v-3.8a3 3 0 0 1 6 0V27" />
      </g>
    </svg>
  );
}

// Wajah KOZY AI: lingkaran putih dengan ikon kilau bergaris tosca, seragam dengan ikon lain.
export function AiAvatar({ size = 'md', className = '' }) {
  const px = { sm: 14, md: 18, lg: 30 }[size] || 18;
  return (
    <span className={`ai-ava ${size === 'md' ? '' : size} ${className}`} aria-hidden="true">
      <Icon name="sparkles" size={px} strokeWidth={2.2} />
    </span>
  );
}
