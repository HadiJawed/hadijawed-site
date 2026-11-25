import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource-variable/archivo/wdth.css';
import './styles.css';
import './dashboard.css';
import './theme.css';
import App from './App.jsx';
import { load, getState } from './lib/store.js';
import { applyTheme } from './lib/theme.js';

// Works offline; picks up new versions automatically
registerSW({ immediate: true });

applyTheme(); // from the quick cache, so there's no light flash before data loads
const root = createRoot(document.getElementById('root'));
root.render(<div className="boot" aria-busy="true" />);
load().then(() => { applyTheme(getState().settings.theme); root.render(<App />); });
