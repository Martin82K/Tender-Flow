import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// Environment variables are accessed via process.env in Netlify Functions
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

let supabase: ReturnType<typeof createClient> | null = null;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export const handler: Handler = async (event, context) => {
  // Path is like /s/AbCdEf or /.netlify/functions/redirect/AbCdEf (depending on how rewrite works)
  // We expect the rewrite to pass the full path.
  // The rule in netlify.toml is: from = "/s/*", to = "/.netlify/functions/redirect"
  // Usually, the event.path will be "/.netlify/functions/redirect" if rewritten,
  // but we need the original path or the splat.
  
  // Let's parse the code from the end of the path.
  // The client requests /s/CODE.
  // The rewrite sends it to the function. Use event.path or check specific rewrite behavior.
  // Typically with "to = /.netlify/functions/redirect/:splat" it works best.
  // Let's assume standard splat behavior.
  
  const pathParts = event.path.split('/');
  const code = pathParts[pathParts.length - 1]; // Last part of the path

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

    // Fire and forget click increment using RPC
    try {
        await supabase.rpc('increment_short_url_clicks', { url_id: code });
    } catch (e) {
        console.error('Failed to increment clicks', e);
    }
    
    return {
      statusCode: 301,
      headers: {
        Location: data.original_url,
        'Cache-Control': 'public, max-age=300', // Cache for 5 mins
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
