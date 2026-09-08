// Narrow declarations for the semver runtime already used by electron-updater.
declare module 'semver' {
    export function valid(version: string): string | null;
    export function gt(a: string, b: string): boolean;
    export function compare(a: string, b: string): -1 | 0 | 1;
}
