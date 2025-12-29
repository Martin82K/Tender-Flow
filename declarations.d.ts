declare module '*.jpg';
declare module '*.png';
declare module '*.svg';

declare global {
  interface Window {
    gapi?: any;
    google?: any;
  }
}

export {};
