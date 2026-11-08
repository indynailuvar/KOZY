import { useState } from 'react';
import Icon from './Icon.jsx';
import { Button } from './ui.jsx';
import { useStore } from '../store.jsx';

export function WaitlistBox({ nama, dikenal, belumData = false }) {
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
          <b>{dikenal ? `${nama} belum tercakup` : 'Lokasi belum dikenali'}</b>
          <p>
            {belumData
              ? 'Iklan kos di kecamatan ini belum cukup untuk dinilai. KOZY tidak menebak angka.'
              : dikenal
                ? 'KOZY baru menilai kos di Kota Surabaya.'
                : 'Coba ketik nama kelurahan atau kecamatan di Surabaya, atau tempel link Google Maps.'}
          </p>
        </div>
      </div>
      {(dikenal || belumData) &&
        (terkirim ? (
          <p className="waitlist-ok">
            <Icon name="checkc" size={18} /> Kamu masuk daftar tunggu. Kami kabari kalau daerah ini sudah bisa dicek.
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
