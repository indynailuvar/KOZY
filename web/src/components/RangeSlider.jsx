// Slider rentang dua sisi (budget minimum–maksimum)
export default function RangeSlider({ min, max, step, value, onChange, format = (v) => v, label = 'Rentang' }) {
  const [lo, hi] = value;
  const pct = (v) => ((v - min) / (max - min)) * 100;
  return (
    <div className="range2">
      <div className="range2-track">
        <i style={{ left: `${pct(lo)}%`, width: `${pct(hi) - pct(lo)}%` }} />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={lo}
        aria-label={`${label} minimum`}
        aria-valuetext={format(lo)}
        onChange={(e) => onChange([Math.min(Number(e.target.value), hi - step), hi])}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={hi}
        aria-label={`${label} maksimum`}
        aria-valuetext={format(hi)}
        onChange={(e) => onChange([lo, Math.max(Number(e.target.value), lo + step)])}
      />
    </div>
  );
}
