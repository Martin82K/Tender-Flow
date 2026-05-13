import * as fs from 'fs';
import * as path from 'path';

type PublicEnvKey =
    | 'VITE_SUPABASE_URL'
    | 'VITE_SUPABASE_ANON_KEY'
    | 'VITE_GOOGLE_OAUTH_CLIENT_ID_DESKTOP';

type DesktopBuildEnvFile = {
    schemaVersion?: number;
    values?: Partial<Record<PublicEnvKey, string>>;
};

let cachedBuildEnv: Partial<Record<PublicEnvKey, string>> | null = null;

const readDesktopBuildEnv = (): Partial<Record<PublicEnvKey, string>> => {
    if (cachedBuildEnv) return cachedBuildEnv;

    const buildEnvPath = path.join(__dirname, '..', 'build-env.json');
    try {
        const parsed = JSON.parse(fs.readFileSync(buildEnvPath, 'utf-8')) as DesktopBuildEnvFile;
        cachedBuildEnv = parsed.values || {};
    } catch {
        cachedBuildEnv = {};
    }

    return cachedBuildEnv;
};

export const getPublicEnvValue = (key: PublicEnvKey): string => {
    return process.env[key] || readDesktopBuildEnv()[key] || '';
};

export const getSupabasePublicConfig = (): { url: string; anonKey: string } => ({
    url: getPublicEnvValue('VITE_SUPABASE_URL') || process.env.SUPABASE_URL || '',
    anonKey: getPublicEnvValue('VITE_SUPABASE_ANON_KEY') || process.env.SUPABASE_ANON_KEY || '',
});
