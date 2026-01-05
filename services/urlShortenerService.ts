/**
 * URL Shortener Service using TinyURL API
 * Uses the TinyURL API to shorten long URLs.
 */

const TINYURL_API_KEY = import.meta.env.VITE_TINYURL_API_KEY;
const TINYURL_API_ENDPOINT = 'https://api.tinyurl.com/create';

export interface ShortenResult {
  success: boolean;
  shortUrl?: string;
  originalUrl: string;
  error?: string;
}

/**
 * Shortens a URL using TinyURL API
 * @param url The long URL to shorten
 * @returns Promise with the shortened URL or error
 */
export async function shortenUrl(url: string): Promise<ShortenResult> {
  if (!TINYURL_API_KEY) {
    console.warn('TinyURL API key not configured. Skipping URL shortening.');
    return {
      success: false,
      originalUrl: url,
      error: 'API key not configured',
    };
  }

  // Don't shorten if already short (e.g., under 50 chars or already tinyurl)
  if (url.length < 50 || url.includes('tinyurl.com')) {
    return {
      success: true,
      shortUrl: url,
      originalUrl: url,
    };
  }

  try {
    const response = await fetch(TINYURL_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TINYURL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url,
        domain: 'tinyurl.com',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('TinyURL API error:', response.status, errorText);
      return {
        success: false,
        originalUrl: url,
        error: `API error: ${response.status}`,
      };
    }

    const data = await response.json();
    
    if (data.data?.tiny_url) {
      return {
        success: true,
        shortUrl: data.data.tiny_url,
        originalUrl: url,
      };
    }

    return {
      success: false,
      originalUrl: url,
      error: 'Unexpected API response',
    };
  } catch (error) {
    console.error('Error shortening URL:', error);
    return {
      success: false,
      originalUrl: url,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Batch shorten multiple URLs
 * @param urls Array of URLs to shorten
 * @returns Promise with array of results
 */
export async function shortenUrls(urls: string[]): Promise<ShortenResult[]> {
  return Promise.all(urls.map(shortenUrl));
}
