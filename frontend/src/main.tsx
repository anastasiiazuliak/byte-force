import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppShell } from './app/AppShell';
import { demoSlots } from './app/demoSlots';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode><AppShell slots={demoSlots} dataMode="demo" /></StrictMode>,
);
