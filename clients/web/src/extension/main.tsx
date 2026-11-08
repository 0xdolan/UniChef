// SPDX-License-Identifier: GPL-3.0-or-later

import '../styles/tokens.css';
import '../styles/global.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { ExtensionApp } from './ExtensionApp.js';

const root = document.getElementById('root');
if (root === null) throw new Error('extension.html has no #root element.');
createRoot(root).render(
  <StrictMode>
    <ExtensionApp />
  </StrictMode>,
);
