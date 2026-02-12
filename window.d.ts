/// <reference types="vite/client" />

import type { ElectronAPI } from './shared/types/desktop';

declare global {
    interface Window {
        electron?: ElectronAPI;
        electronAPI?: ElectronAPI;
    }
}

export { };
