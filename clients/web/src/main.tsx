// SPDX-License-Identifier: GPL-3.0-or-later

import './styles/tokens.css';
import './styles/global.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';

import { App } from './app/App.js';

const root = document.getElementById('root');
if (root === null) throw new Error('index.html has no #root element.');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline support (PRD §6.4). With `autoUpdate`, a new release's service worker takes over
// as soon as it installs and the page reloads into it, so nobody stays on a stale copy.
registerSW({ immediate: true });
