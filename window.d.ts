/// <reference types="vite/client" />

import type { ElectronAPI } from './desktop/main/types';

declare global {
    interface Window {
        electron?: ElectronAPI;
        electronAPI?: ElectronAPI;
    }
}

export { };
