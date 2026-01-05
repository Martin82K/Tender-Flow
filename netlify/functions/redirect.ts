import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

let supabase: ReturnType<typeof createClient> | null = null;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export const handler: Handler = async (event) => {
  const pathParts = event.path.split('/');
  const code = pathParts[pathParts.length - 1];

  if (!code || !supabase) {
    return {
      statusCode: 404,
      body: 'Invalid request or missing configuration',
    };
  }

  try {
    const { data: rawData, error } = await supabase
      .from('short_urls')
      .select('original_url')
      .eq('id', code)
      .single();

    const data = rawData as any;

    if (error || !data) {
      return {
        statusCode: 404,
        body: 'URL not found',
      };
    }

    try {
      await supabase.rpc('increment_short_url_clicks', { url_id: code });
    } catch (e) {
      console.error('Failed to increment clicks', e);
    }

    return {
      statusCode: 301,
      headers: {
        Location: data.original_url,
        'Cache-Control': 'public, max-age=300',
      },
      body: '',
    };
  } catch (error) {
    console.error('Redirect error:', error);
    return {
      statusCode: 500,
      body: 'Internal Server Error',
    };
  }
};
