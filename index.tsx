import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { installErrorReporter } from './errorReporter';

installErrorReporter();

// A product photo that does not open (a partner's link went dead, the photo server is down) shows a neat
// grey placeholder instead of an empty square or the browser's "broken picture" sign.
const PHOTO_PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#18181b"/>' +
  '<g fill="none" stroke="#52525b" stroke-width="4" stroke-linejoin="round"><path d="M38 46l22-12 22 12v28l-22 12-22-12z"/><path d="M38 46l22 12 22-12M60 58v28"/></g></svg>');
document.addEventListener('error', (e) => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement) || img.dataset.photoFallback || img.src.startsWith('data:')) return;
  if (!/supabase\.co\/storage|\.(jpe?g|png|webp|gif)(\?|$)/i.test(img.src) && !img.closest('[data-product-photo]')) return;
  img.dataset.photoFallback = '1';
  img.removeAttribute('srcset');
  img.src = PHOTO_PLACEHOLDER;
}, true);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);