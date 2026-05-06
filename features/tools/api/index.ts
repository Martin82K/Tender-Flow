export {
  deleteShortUrl,
  deleteShortUrl as deleteUrl,
  getUserLinks,
  getUserLinks as getMyUrls,
  getUserLinkStats,
  shortenUrl,
  shortenUrlWithAlias,
} from "@/services/urlShortenerService";
export type {
  ShortenResult,
  UserLink,
  UserLinkStats,
} from "@/services/urlShortenerService";
