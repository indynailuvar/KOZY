import { useState } from 'react';
import Icon from './Icon.jsx';
import { Button } from './ui.jsx';
import { useStore } from '../store.jsx';

export function WaitlistBox({ nama, dikenal }) {
  const { toast } = useStore();
  const [kontak, setKontak] = useState('');
  const [terkirim, setTerkirim] = useState(false);
  const valid = /\S+@\S+\.\S+/.test(kontak) || /^\+?\d[\d\s-]{8,}$/.test(kontak);

  return (
    <div className="waitlist">
      <div className="waitlist-h">
        <span className="ic-circle sm">
          <Icon name="map" size={16} />
        </span>
        <div>
          <b>{dikenal ? `${nama} belum tercakup` : 'Lokasi belum kami kenali'}</b>
          <p>
            {dikenal
              ? 'Saat ini KOZY baru menilai kos di Kota Surabaya.'
              : 'Coba ketik nama kelurahan/kecamatan di Surabaya, atau tempel link Google Maps.'}
          </p>
        </div>
      </div>
      {dikenal &&
        (terkirim ? (
          <p className="waitlist-ok">
            <Icon name="checkc" size={18} /> Kamu masuk daftar tunggu. Kami kabari saat kawasan ini siap.
          </p>
        ) : (
          <div className="waitlist-form">
            <input value={kontak} onChange={(e) => setKontak(e.target.value)} placeholder="Email atau WhatsApp" aria-label="Email atau nomor WhatsApp" />
            <Button
              variant="secondary"
              size="sm"
              icon="bell"
              disabled={!valid}
              onClick={() => {
                setTerkirim(true);
                toast('Kamu masuk daftar tunggu');
              }}
            >
              Kabari saya
            </Button>
          </div>
        ))}
    </div>
  );
}
