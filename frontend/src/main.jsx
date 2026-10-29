import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { NexusProvider } from './store/NexusContext';
import { ToastProvider } from './components/Toast';
import { PaletteProvider } from './store/PaletteContext';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <NexusProvider>
          <PaletteProvider>
            <App />
          </PaletteProvider>
        </NexusProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);
