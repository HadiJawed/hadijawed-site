import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource-variable/archivo/wdth.css';
import './styles.css';
import App from './App.jsx';
import { load } from './lib/store.js';

// Works offline; picks up new versions automatically
registerSW({ immediate: true });

const root = createRoot(document.getElementById('root'));
root.render(<div className="boot" aria-busy="true" />);
load().then(() => root.render(<App />));
