/**
 * URL Shortener Service
 * Supports both custom Supabase implementation (TF URL) and TinyURL API.
 */

import { supabase } from './supabase';
import { ShortUrl } from '../types';

export interface ShortenResult {
  success: boolean;
  shortUrl?: string;
  code?: string;
  originalUrl: string;
  error?: string;
  provider?: 'tfurl' | 'tinyurl';
}

const SHORT_URL_BASE = window.location.origin + '/s/';

// TinyURL Configuration
const TINYURL_API_KEY = import.meta.env.VITE_TINYURL_API_KEY;
const TINYURL_API_ENDPOINT = 'https://api.tinyurl.com/create';

/**
 * Generates a random short code (6 chars)
 */
function generateShortCode(length: number = 6): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Shortens a URL using TinyURL API
 */
async function shortenWithTinyUrl(url: string): Promise<ShortenResult> {
  if (!TINYURL_API_KEY) {
    console.warn('TinyURL API key not configured.');
    return { success: false, originalUrl: url, error: 'TinyURL API key missing' };
  }

  try {
    const response = await fetch(TINYURL_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TINYURL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: url, domain: 'tinyurl.com' }),
    });

    if (!response.ok) {
      throw new Error(`TinyURL API error: ${response.status}`);
    }

    const data = await response.json();
    if (data.data?.tiny_url) {
      return {
        success: true,
        shortUrl: data.data.tiny_url,
        originalUrl: url,
        provider: 'tinyurl'
      };
    }
    throw new Error('Unexpected TinyURL response');
  } catch (error) {
    console.error('TinyURL error:', error);
    return {
      success: false,
      originalUrl: url,
      error: error instanceof Error ? error.message : 'Unknown error',
      provider: 'tinyurl'
    };
  }
}

/**
 * Shortens a URL using Supabase (TF URL)
 */
async function shortenWithTfUrl(url: string, userId?: string): Promise<ShortenResult> {
  // Check if it's already a TF URL
  if (url.startsWith(SHORT_URL_BASE)) {
    return {
      success: true,
      shortUrl: url,
      code: url.replace(SHORT_URL_BASE, ''),
      originalUrl: url,
      provider: 'tfurl'
    };
  }

  try {
    let code = "";
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 5) {
      code = generateShortCode();
      const { data } = await supabase.from('short_urls').select('id').eq('id', code).single();
      if (!data) isUnique = true;
      attempts++;
    }

    if (!isUnique) throw new Error("Could not generate unique code");

    const { error } = await supabase
      .from('short_urls')
      .insert({
        id: code,
        original_url: url,
        created_by: userId,
        clicks: 0
      });

    if (error) throw error;

    return {
      success: true,
      shortUrl: `${SHORT_URL_BASE}${code}`,
      code: code,
      originalUrl: url,
      provider: 'tfurl'
    };
  } catch (error) {
    console.error('TF URL error:', error);
    return {
      success: false,
      originalUrl: url,
      error: error instanceof Error ? error.message : 'Unknown error',
      provider: 'tfurl'
    };
  }
}

/**
 * Main shorten function that respects user preference
 */
export async function shortenUrl(url: string): Promise<ShortenResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    // Check user preference
    let provider = 'tfurl'; // Default
    if (user) {
      const { data: settings } = await supabase
        .from('user_settings')
        .select('preferences')
        .eq('user_id', user.id)
        .single();
        
      if (settings?.preferences?.urlShortenerProvider) {
        provider = settings.preferences.urlShortenerProvider;
      }
    }

    if (provider === 'tinyurl') {
      return shortenWithTinyUrl(url);
    } else {
      return shortenWithTfUrl(url, user?.id);
    }
  } catch (error) {
    console.error('Error determining provider:', error);
    // Fallback to TF URL if anything fails
    return shortenWithTfUrl(url);
  }
}

/**
 * Retrieves the original URL for a given code (TF URL only)
 */
export async function getOriginalUrl(code: string): Promise<{ url: string | null; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('short_urls')
      .select('original_url')
      .eq('id', code)
      .single();

    if (error) throw error;
    if (!data) return { url: null };

    supabase.rpc('increment_short_url_clicks', { url_id: code }).then(({ error }) => {
      if (error) console.error("Failed to increment clicks:", error);
    });

    return { url: data.original_url };

  } catch (error) {
    console.error('Error fetching original URL:', error);
    return { url: null, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Batch shorten multiple URLs
 */
export async function shortenUrls(urls: string[]): Promise<ShortenResult[]> {
  return Promise.all(urls.map(shortenUrl));
}
