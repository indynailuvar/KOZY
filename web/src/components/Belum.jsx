// Penanda data yang belum ada — supaya dashboard tetap bisa dipertanggungjawabkan.
//
// Dashboard ini dibaca pemilik kos, investor, dan dosen penguji. Grafik kosong
// tanpa keterangan membuat orang menebak: apakah angkanya nol, apakah rusak,
// atau apakah memang belum dikumpulkan? Tiga hal yang sangat berbeda.
//
// Karena itu tiap bagian yang datanya belum ada memakai penanda ini, dengan
// sebab yang eksplisit. Lebih baik berkata "belum dikumpulkan" daripada
// menampilkan nol yang terbaca seolah fakta.
//
// Tiga keadaan:
//   kosong   data sudah bisa masuk, tapi belum ada yang mengisinya (mis. aktivitas)
//   menunggu sedang dikerjakan di tempat lain (mis. data dari rekan tim)
//   mustahil tidak bisa dihitung dengan data yang ada sekarang (mis. forecast)
import Icon from './Icon.jsx';

const GAYA = {
  kosong: { icon: 'db', label: 'Belum ada data' },
  menunggu: { icon: 'refresh', label: 'Menunggu data' },
  mustahil: { icon: 'alert', label: 'Belum bisa dihitung' },
};

export default function Belum({ keadaan = 'kosong', judul, children, syarat }) {
  const g = GAYA[keadaan] || GAYA.kosong;
  return (
    <div className={`belum belum-${keadaan}`} role="status">
      <span className="belum-ic">
        <Icon name={g.icon} size={20} />
      </span>
      <div>
        <b>{judul || g.label}</b>
        {children && <p>{children}</p>}
        {syarat && (
          <p className="belum-syarat">
            <b>Agar terisi:</b> {syarat}
          </p>
        )}
      </div>
    </div>
  );
}
