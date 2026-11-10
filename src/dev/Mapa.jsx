import { useState } from 'react';
import { telFmt, dist } from '../lib/fmt.js';
import { meters, mapsUrl, osmEmbed } from '../lib/device.js';
import { Back } from './ui.jsx';

// t: cliente o propuesta (ambos tienen nombre, dirección, distrito, lat, lng, responsable, teléfono)
export default function Mapa({ t, pos, back, backLbl }) {
  const [copied, setCopied] = useState(false);
  const code = t.codigo || t.codigo_cliente;
  const d = meters(pos, t);
  const dir = [t.direccion, t.distrito].filter(Boolean).join(', ');
  async function copiar() {
    try { await navigator.clipboard.writeText(dir + ', Lima'); setCopied(true); } catch { /* sin permiso de portapapeles */ }
  }
  return (
    <div className="scr">
      <div style={{ padding: '20px 12px 8px' }}><Back onClick={back}>{backLbl || 'Volver'}</Back></div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative', background: '#EFEFF0' }}>
        {t.lat != null ? (
          <iframe title={'Mapa de ' + t.nombre} src={osmEmbed(t.lat, t.lng)} style={{ border: 0, width: '100%', height: '100%', display: 'block', filter: 'grayscale(.35)' }} loading="lazy" />
        ) : (
          <div className="muted" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', fontSize: 14 }}>Este cliente aún no tiene coordenadas. Abre Maps para buscar la dirección.</div>
        )}
      </div>
      <div style={{ padding: '20px 24px calc(20px + env(safe-area-inset-bottom))', borderTop: '1px solid #E6E6E6', background: '#FFFFFF', flex: 'none' }}>
        <div className="lbl">Cód. {code}</div>
        <div className="ellip" style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.01em', marginTop: 6 }}>{t.nombre}</div>
        <p style={{ margin: '6px 0 0', fontSize: 14 }}>{t.direccion || '—'}</p>
        <p className="muted" style={{ margin: '2px 0 0', fontSize: 13 }}>{(t.distrito || '') + ', Lima'}{d != null ? ' · a ' + dist(d) + ' de tu ubicación' : ''}</p>
        <p style={{ margin: '8px 0 0', fontSize: 13 }}>Responsable: {t.responsable || '—'}{t.telefono && <> · <a href={'tel:+51' + t.telefono} style={{ fontWeight: 600 }}>{telFmt(t.telefono)}</a></>}</p>
        <div style={{ display: 'flex', gap: 12, marginTop: 18 }}>
          <button type="button" className="btnS" style={{ width: 120, flex: 'none' }} onClick={copiar}>{copied ? 'Copiada' : 'Copiar'}</button>
          <a className="btnP" href={mapsUrl(t)} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>Abrir en Maps</a>
        </div>
      </div>
    </div>
  );
}
