import { useEffect } from "react";
import { useLocation } from "@/shared/routing/router";
import { resolveSeo, SITE_NAME, SITE_URL, DEFAULT_OG_IMAGE } from "./seoConfig";

const METADATA_TAG = "data-seo-managed";

const upsertMeta = (
  selector: string,
  attr: "name" | "property",
  key: string,
  value: string | undefined,
) => {
  const head = document.head;
  let el = head.querySelector<HTMLMetaElement>(selector);

  if (!value) {
    if (el?.hasAttribute(METADATA_TAG)) el.remove();
    return;
  }

  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    el.setAttribute(METADATA_TAG, "true");
    head.appendChild(el);
  }
  el.setAttribute("content", value);
};

const upsertLink = (rel: string, href: string | undefined) => {
  const head = document.head;
  const selector = `link[rel="${rel}"]`;
  let el = head.querySelector<HTMLLinkElement>(selector);

  if (!href) {
    if (el?.hasAttribute(METADATA_TAG)) el.remove();
    return;
  }

  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    el.setAttribute(METADATA_TAG, "true");
    head.appendChild(el);
  }
  el.setAttribute("href", href);
};

export const useSeo = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const meta = resolveSeo(pathname);
    const image = meta.image || DEFAULT_OG_IMAGE;
    const canonical =
      meta.canonical ||
      `${SITE_URL}${pathname === "/" ? "/" : pathname.replace(/\/+$/, "")}`;

    document.title = meta.title;

    upsertMeta('meta[name="description"]', "name", "description", meta.description);
    upsertLink("canonical", canonical);

    const robotsValue = meta.noindex
      ? "noindex, nofollow"
      : "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1";
    upsertMeta('meta[name="robots"]', "name", "robots", robotsValue);

    upsertMeta('meta[property="og:title"]', "property", "og:title", meta.title);
    upsertMeta(
      'meta[property="og:description"]',
      "property",
      "og:description",
      meta.description,
    );
    upsertMeta('meta[property="og:url"]', "property", "og:url", canonical);
    upsertMeta('meta[property="og:image"]', "property", "og:image", image);
    upsertMeta(
      'meta[property="og:site_name"]',
      "property",
      "og:site_name",
      SITE_NAME,
    );
    upsertMeta(
      'meta[property="og:type"]',
      "property",
      "og:type",
      pathname === "/" ? "website" : "article",
    );

    upsertMeta(
      'meta[name="twitter:title"]',
      "name",
      "twitter:title",
      meta.title,
    );
    upsertMeta(
      'meta[name="twitter:description"]',
      "name",
      "twitter:description",
      meta.description,
    );
    upsertMeta('meta[name="twitter:image"]', "name", "twitter:image", image);
  }, [pathname]);
};
