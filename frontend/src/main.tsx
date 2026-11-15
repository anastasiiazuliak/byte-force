import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfiguredMission } from './app/MissionApp';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode><ConfiguredMission /></StrictMode>,
);
import { Application } from './app/Application';
import './styles/index.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><Application /></React.StrictMode>);
