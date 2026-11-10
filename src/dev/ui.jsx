import Icon from '../Icon.jsx';

const INK = '#2E2E30', RED = '#AC1622';

export function segStyle(on, neg, alt) {
  if (!on) return { background: '#FFFFFF', color: '#6B6B6B', border: '1px solid #E6E6E6' };
  if (alt) return { background: '#6B6B6B', color: '#FFFFFF', border: '1px solid #6B6B6B' };
  return neg ? { background: RED, color: '#FFFFFF', border: '1px solid ' + RED } : { background: INK, color: '#FFFFFF', border: '1px solid ' + INK };
}

// Botones Sí / No (/ N/A)
export function YesNo({ value, onChange, label, na }) {
  const opts = [{ v: 'si', l: 'Sí' }, { v: 'no', l: 'No' }].concat(na ? [{ v: 'na', l: 'N/A' }] : []);
  return (
    <span style={{ display: 'flex', gap: 6 }}>
      {opts.map((o) => (
        <button key={o.v} type="button" className="seg" aria-pressed={value === o.v} aria-label={label + ': ' + o.l}
          onClick={() => onChange(o.v)} style={segStyle(value === o.v, o.v === 'no', o.v === 'na')}>{o.l}</button>
      ))}
    </span>
  );
}

export function RadioList({ items, value, onPick, label = 'Motivo', minH = 56 }) {
  return (
    <div role="radiogroup" aria-label={label} style={{ borderTop: '1px solid #E6E6E6' }}>
      {items.map((l) => {
        const on = value === l;
        return (
          <button key={l} type="button" role="radio" aria-checked={on} className="radio" style={{ minHeight: minH }} onClick={() => onPick(l)}>
            <span className="ring" style={{ border: '1.5px solid ' + (on ? INK : '#8C8C8C') }}><span style={{ background: on ? INK : 'transparent' }} /></span>
            <span style={{ fontSize: 16, fontWeight: 600 }}>{l}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Back({ onClick, children }) {
  return (
    <button type="button" className="back" onClick={onClick}>
      <Icon n="back" s={22} />{children}
    </button>
  );
}

export function Check({ on }) {
  return (
    <span className="cbox" style={on ? { background: INK, color: '#FFFFFF', border: '1.5px solid ' + INK } : { background: '#FFFFFF', color: 'transparent', border: '1.5px solid #8C8C8C' }}>
      <Icon n="check" s={16} w={2} />
    </span>
  );
}

export function OkDot({ red, size = 28, x }) {
  return (
    <span style={{ width: size, height: size, borderRadius: size / 2, background: red ? RED : INK, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
      <Icon n={x ? 'close' : 'check'} s={16} w={2} />
    </span>
  );
}

export function Steps({ n, cur, done }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gap: 4, padding: '12px 24px 0' }}>
      {Array.from({ length: n }, (_, i) => i + 1).map((k) => (
        <span key={k} style={{ height: 3, borderRadius: 2, transition: 'background .3s', background: done || k < cur ? INK : k === cur ? RED : '#E6E6E6' }} />
      ))}
    </div>
  );
}

export function FlowHead({ label, sub, onExit, exitLabel }) {
  return (
    <div style={{ padding: '20px 12px 0 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="lbl">{label}</div>
        <div className="ellip" style={{ fontSize: 13, color: '#6B6B6B', marginTop: 4 }}>{sub}</div>
      </div>
      <button type="button" className="icbtn" onClick={onExit} aria-label={exitLabel}><Icon n="close" s={22} /></button>
    </div>
  );
}

// Pestañas del hero oscuro (Visitados / No efectivos / Pendientes)
export function HeroTabs({ items, value, onPick, label }) {
  return (
    <div role="tablist" aria-label={label} style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`, gap: 6, marginTop: 12 }}>
      {items.map((t) => {
        const on = t.id === value;
        return (
          <button key={t.id} type="button" role="tab" aria-selected={on} onClick={() => onPick(t.id)}
            style={{ height: 44, padding: '0 6px', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, whiteSpace: 'nowrap', transition: 'background .2s, color .2s', ...(on ? { background: '#FFFFFF', color: INK } : { background: 'transparent', color: '#FFFFFF', boxShadow: 'inset 0 0 0 1px #4A4A4D' }) }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>{t.n}</span>
            <span style={{ fontSize: 12, color: on ? '#6B6B6B' : '#B4B4B8' }}>{t.l}</span>
          </button>
        );
      })}
    </div>
  );
}

export function MainBtn({ can, busy, onClick, children }) {
  return (
    <button type="button" className="btnP" disabled={!can || busy} onClick={can && !busy ? onClick : undefined}>
      {busy && <span className="spin" />}{children}
    </button>
  );
}
