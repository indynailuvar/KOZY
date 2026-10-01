import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { StoreProvider } from './store.jsx';
import './styles.css';
import './map.css';

// Aplikasi memakai hash router (#/halaman). Kalau alamat diketik tanpa tanda pagar
// (mis. localhost:5173/admin), arahkan ke bentuk hash-nya supaya tetap terbuka.
const dasar = import.meta.env.BASE_URL.replace(/\/$/, '');
const jalur = window.location.pathname.replace(dasar, '').replace(/\/$/, '');
if (jalur && !window.location.hash) window.location.replace(`${dasar}/#${jalur}${window.location.search}`);

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </React.StrictMode>,
);
