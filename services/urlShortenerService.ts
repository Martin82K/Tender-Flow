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

// ============================================================================
// New Functions for URL Shortener Redesign
// ============================================================================

export interface UserLinkStats {
  totalLinks: number;
  totalClicks: number;
}

export interface UserLink {
  id: string;
  originalUrl: string;
  shortUrl: string;
  clicks: number;
  createdAt: string;
  title?: string;
}

/**
 * Get all links created by the current user
 */
export async function getUserLinks(): Promise<{ links: UserLink[]; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { links: [], error: 'Not authenticated' };

    const { data, error } = await supabase
      .from('short_urls')
      .select('id, original_url, clicks, created_at, title')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const links: UserLink[] = (data || []).map((row: any) => ({
      id: row.id,
      originalUrl: row.original_url,
      shortUrl: `${SHORT_URL_BASE}${row.id}`,
      clicks: row.clicks || 0,
      createdAt: row.created_at,
      title: row.title,
    }));

    return { links };
  } catch (error) {
    console.error('Error fetching user links:', error);
    return { links: [], error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Get stats for the current user's links
 */
export async function getUserLinkStats(): Promise<UserLinkStats> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { totalLinks: 0, totalClicks: 0 };

    const { data, error } = await supabase
      .from('short_urls')
      .select('clicks')
      .eq('created_by', user.id);

    if (error) throw error;

    const totalLinks = data?.length || 0;
    const totalClicks = data?.reduce((sum: number, row: any) => sum + (row.clicks || 0), 0) || 0;

    return { totalLinks, totalClicks };
  } catch (error) {
    console.error('Error fetching user link stats:', error);
    return { totalLinks: 0, totalClicks: 0 };
  }
}

/**
 * Delete a short URL by its code
 */
export async function deleteShortUrl(code: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('short_urls')
      .delete()
      .eq('id', code);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error deleting short URL:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Shorten a URL with an optional custom alias (TF URL only)
 */
export async function shortenUrlWithAlias(
  url: string, 
  customAlias?: string
): Promise<ShortenResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (customAlias) {
      if (!/^[a-zA-Z0-9_-]+$/.test(customAlias)) {
        return { success: false, originalUrl: url, error: 'Alias může obsahovat pouze písmena, čísla, pomlčky a podtržítka' };
      }
      if (customAlias.length < 3 || customAlias.length > 20) {
        return { success: false, originalUrl: url, error: 'Alias musí mít 3-20 znaků' };
      }
      
      const { data } = await supabase.from('short_urls').select('id').eq('id', customAlias).single();
      if (data) {
        return { success: false, originalUrl: url, error: 'Tento alias už je používán' };
      }
    }

    const code = customAlias || generateShortCode();

    const { error } = await supabase
      .from('short_urls')
      .insert({ id: code, original_url: url, created_by: user?.id, clicks: 0 });

    if (error) throw error;

    return { success: true, shortUrl: `${SHORT_URL_BASE}${code}`, code, originalUrl: url, provider: 'tfurl' };
  } catch (error) {
    console.error('TF URL error:', error);
    return { success: false, originalUrl: url, error: error instanceof Error ? error.message : 'Unknown error', provider: 'tfurl' };
  }
}
