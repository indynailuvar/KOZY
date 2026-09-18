import { useEffect, useId, useRef, useState } from 'react';
import Icon from './Icon.jsx';

export function Button({ variant = 'primary', size, icon, iconRight, block, className = '', children, ...rest }) {
  const cls = ['btn', `btn-${variant}`, size && `btn-${size}`, block && 'btn-block', className].filter(Boolean).join(' ');
  return (
    <button type="button" className={cls} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children != null && children !== false && <span>{children}</span>}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 16 : 18} />}
    </button>
  );
}

const STATUS = {
  KEMAHALAN: { cls: 'st-kem', icon: 'alert', teks: 'Kemahalan' },
  WAJAR: { cls: 'st-waj', icon: 'checkc', teks: 'Wajar' },
  MURAH: { cls: 'st-mur', icon: 'tag', teks: 'Murah' },
  CEK: { cls: 'st-cek', icon: 'alert', teks: 'Perlu dicek' },
};

export function StatusBadge({ status, size }) {
  const s = STATUS[status];
  return (
    <span className={`badge ${s.cls} ${size === 'sm' ? 'badge-sm' : ''}`}>
      <Icon name={s.icon} size={size === 'sm' ? 12 : 15} strokeWidth={2.4} />
      {s.teks}
    </span>
  );
}

// Tombol kembali persegi membulat (gaya SS1)
export function BackButton({ onClick, label = 'Kembali' }) {
  return (
    <button type="button" className="back-btn" onClick={onClick} aria-label={label}>
      <Icon name="left" size={20} strokeWidth={2.4} />
    </button>
  );
}

// Kerangka formulir langkah demi langkah
export function Wizard({ judul, langkah, total, onBack, children, footer }) {
  const bodyRef = useRef(null);
  useEffect(() => {
    document.body.classList.add('wz-mode');
    return () => document.body.classList.remove('wz-mode');
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
    bodyRef.current?.querySelector('input:not([type]):not([data-noauto])')?.focus({ preventScroll: true });
  }, [langkah]);
  return (
    <div className="wz">
      <a href="#/" className="logo wz-brand" aria-label="KOZY beranda">
        <span className="logo-mark">
          <Icon name="home" size={16} strokeWidth={2.6} />
        </span>
        KOZY
      </a>
      <div className="wz-card">
        <div className="wz-top">
          <BackButton onClick={onBack} />
          <div className="wz-title">
            <b>{judul}</b>
            {total > 1 && (
              <span>
                Langkah {langkah} dari {total}
              </span>
            )}
          </div>
        </div>
        {total > 1 && (
          <div className="wz-progress" role="progressbar" aria-label="Kemajuan" aria-valuemin={1} aria-valuemax={total} aria-valuenow={langkah}>
            <i style={{ width: `${(langkah / total) * 100}%` }} />
          </div>
        )}
        <div className="wz-body" ref={bodyRef} key={langkah}>
          {children}
        </div>
        <div className="wz-foot">{footer}</div>
      </div>
    </div>
  );
}

export function Question({ judul, sub }) {
  return (
    <div className="wz-q">
      <h1>{judul}</h1>
      {sub && <p>{sub}</p>}
    </div>
  );
}

// Pilihan tunggal berbentuk baris besar
export function Options({ value, onChange, options, label }) {
  return (
    <div className="opts" role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const on = value === o.id;
        return (
          <button key={o.id} type="button" role="radio" aria-checked={on} className={`opt ${on ? 'is-on' : ''}`} onClick={() => onChange(o.id)}>
            {o.icon && (
              <span className="ic-circle">
                <Icon name={o.icon} size={20} />
              </span>
            )}
            <span className="opt-t">
              <b>{o.label}</b>
              {o.sub && <small>{o.sub}</small>}
            </span>
            <span className="opt-radio" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

// Pilihan ganda berbentuk ubin
export function Tiles({ values, onToggle, options, label }) {
  return (
    <div className="tiles" role="group" aria-label={label}>
      {options.map((o) => {
        const on = values.includes(o.id);
        return (
          <button key={o.id} type="button" aria-pressed={on} className={`tile ${on ? 'is-on' : ''}`} onClick={() => onToggle(o.id)}>
            <Icon name={o.icon} size={20} />
            <span>{o.label}</span>
            <span className="tile-check" aria-hidden="true">
              {on && <Icon name="check" size={12} strokeWidth={3.2} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Input nominal besar bergaris bawah (gaya SS1)
export function AmountInput({ id, value, onChange, prefix, suffix, placeholder, label, max = 20_000_000 }) {
  return (
    <label className="amount" htmlFor={id}>
      {prefix && <span className="amount-pre">{prefix}</span>}
      <input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        value={value ? value.toLocaleString('id-ID') : ''}
        onChange={(e) => onChange(Math.min(max, Number(e.target.value.replace(/[^0-9]/g, '')) || 0))}
        placeholder={placeholder}
        aria-label={label}
      />
      {suffix && <span className="amount-suf">{suffix}</span>}
    </label>
  );
}

// Isian bergaris bawah untuk langkah yang punya beberapa isian
export function LineInput({ id, label, hint, value, onChange, prefix, suffix, placeholder, inputMode, autoFocus }) {
  return (
    <div className="line-f">
      <label htmlFor={id}>
        {label}
        {hint && <span> {hint}</span>}
      </label>
      <div className="line-in">
        {prefix && <span className="line-pre">{prefix}</span>}
        <input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} inputMode={inputMode} autoComplete="off" autoFocus={autoFocus} />
        {suffix && <span className="line-suf">{suffix}</span>}
      </div>
    </div>
  );
}

export function Segmented({ value, onChange, options, label }) {
  return (
    <div className="seg" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" role="tab" aria-selected={value === o.id} className={value === o.id ? 'is-on' : ''} onClick={() => onChange(o.id)}>
          {o.icon && <Icon name={o.icon} size={16} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, hint, error, children, htmlFor }) {
  return (
    <div className={`fld ${error ? 'has-err' : ''}`}>
      {label && (
        <label className="fld-l" htmlFor={htmlFor}>
          {label}
          {hint && <span className="fld-h"> {hint}</span>}
        </label>
      )}
      {children}
      {error && (
        <p className="err" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function Chip({ active, icon, children, ...rest }) {
  return (
    <button type="button" className={`chip ${active ? 'is-on' : ''}`} aria-pressed={!!active} {...rest}>
      {icon && <Icon name={icon} size={15} />}
      {children}
    </button>
  );
}

export function Switch({ checked, onChange, label, sub }) {
  return (
    <label className="switch-row">
      <span>
        {label}
        {sub && <small>{sub}</small>}
      </span>
      <input type="checkbox" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function Sheet({ open, onClose, children, label, dismissable = true, className = '' }) {
  const ref = useRef(null);
  const latest = useRef({ onClose, dismissable });
  latest.current = { onClose, dismissable };
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    ref.current?.focus();
    const onKey = (e) => e.key === 'Escape' && latest.current.dismissable && latest.current.onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
      prev?.focus?.();
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="sheet-wrap" onMouseDown={(e) => e.target === e.currentTarget && dismissable && onClose?.()}>
      <div className={`sheet ${className}`} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} ref={ref}>
        <div className="sheet-grab" />
        {dismissable && (
          <button type="button" className="sheet-close" onClick={onClose} aria-label="Tutup">
            <Icon name="x" size={20} />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

export function Accordion({ title, icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className={`acc ${open ? 'is-open' : ''}`}>
      <button type="button" className="acc-h" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        {icon && (
          <span className="ic-circle sm">
            <Icon name={icon} size={16} />
          </span>
        )}
        <span>{title}</span>
        <Icon name="down" size={18} className="acc-chev" />
      </button>
      {open && (
        <div className="acc-b" id={id}>
          {children}
        </div>
      )}
    </div>
  );
}

export function InfoTip({ label = 'Info', children }) {
  const [pos, setPos] = useState(null);
  const btn = useRef(null);
  const open = () => {
    const r = btn.current.getBoundingClientRect();
    const w = Math.min(260, window.innerWidth - 24);
    const left = Math.max(12, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 12));
    const atas = r.top > 160;
    setPos({ left, width: w, ...(atas ? { bottom: window.innerHeight - r.top + 8 } : { top: r.bottom + 8 }) });
  };
  const close = () => setPos(null);
  useEffect(() => {
    if (!pos) return;
    const onDown = (e) => !btn.current?.contains(e.target) && close();
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [pos]);
  return (
    <span className="tip" onMouseEnter={open} onMouseLeave={close}>
      <button ref={btn} type="button" className="tip-btn" aria-label={label} aria-expanded={!!pos} onClick={open} onBlur={close} onKeyDown={(e) => e.key === 'Escape' && close()}>
        <Icon name="info" size={15} />
      </button>
      {pos && (
        <span className="tip-pop" role="tooltip" style={pos}>
          {children}
        </span>
      )}
    </span>
  );
}

export function ScoreRing({ value, size = 48, label }) {
  const c = 2 * Math.PI * 15.5;
  return (
    <span className="ring" style={{ width: size, height: size }} role="img" aria-label={`${label || 'Skor'} ${value} dari 100`}>
      <svg viewBox="0 0 36 36" width={size} height={size}>
        <circle cx="18" cy="18" r="15.5" className="ring-bg" />
        <circle cx="18" cy="18" r="15.5" className="ring-fg" strokeDasharray={`${(c * value) / 100} ${c}`} />
      </svg>
      <b>{value}</b>
    </span>
  );
}

// Aksi utama: menempel di bawah layar (mobile) / ikut alur di desktop.
export function ActionBar({ children, note }) {
  useEffect(() => {
    document.body.classList.add('has-actionbar');
    return () => document.body.classList.remove('has-actionbar');
  }, []);
  return (
    <>
      <div className="actionbar-space" />
      <div className="actionbar">
        <div className="actionbar-in">
          {children}
          {note && <p className="actionbar-note">{note}</p>}
        </div>
      </div>
    </>
  );
}

export function Banner({ tone = 'info', icon = 'info', title, children }) {
  return (
    <div className={`banner banner-${tone}`} role="note">
      <Icon name={icon} size={18} />
      <div>
        {title && <b>{title}</b>}
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, children, action }) {
  return (
    <div className="empty">
      <span className="ic-circle xl">
        <Icon name={icon} size={30} strokeWidth={1.8} />
      </span>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function PageHead({ judul, sub, onBack, aksi }) {
  return (
    <header className="page-head">
      {onBack && <BackButton onClick={onBack} />}
      <div className="page-head-t">
        <h1>{judul}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {aksi}
    </header>
  );
}

// Baris daftar (ikon – teks – panah)
export function ListRow({ icon, title, sub, href, onClick, right }) {
  const isi = (
    <>
      <span className="ic-circle">
        <Icon name={icon} size={19} />
      </span>
      <span className="lr-t">
        <b>{title}</b>
        {sub && <small>{sub}</small>}
      </span>
      {right || <Icon name="right" size={18} className="lr-go" />}
    </>
  );
  return href ? (
    <a className="lr" href={href}>
      {isi}
    </a>
  ) : (
    <button type="button" className="lr" onClick={onClick}>
      {isi}
    </button>
  );
}
