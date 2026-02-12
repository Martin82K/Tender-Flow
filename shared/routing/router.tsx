import React, { useCallback, useEffect, useMemo, useState } from "react";

type LocationState = {
  pathname: string;
  search: string;
  hash: string;
};

// Detect if running in Electron with file:// protocol
const isFileProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:';

const getLocation = (): LocationState => {
  if (isFileProtocol) {
    // In Electron file:// mode, use hash-based routing
    // e.g., file:///path/to/index.html#/login becomes pathname="/login"
    const hash = window.location.hash || '#/';
    const hashPath = hash.slice(1); // Remove the '#'
    const [pathname, search = ''] = hashPath.split('?');
    return {
      pathname: pathname || '/',
      search: search ? `?${search}` : '',
      hash: '',
    };
  }
  return {
    pathname: window.location.pathname || '/',
    search: window.location.search || '',
    hash: window.location.hash || '',
  };
};

const isModifiedEvent = (event: React.MouseEvent) =>
  event.metaKey || event.altKey || event.ctrlKey || event.shiftKey;

const isExternalHref = (href: string) =>
  href.startsWith("http://") ||
  href.startsWith("https://") ||
  href.startsWith("mailto:") ||
  href.startsWith("tel:");

export const navigate = (to: string, opts?: { replace?: boolean }) => {
  let url = to.startsWith("/") || to.startsWith("#") ? to : `/${to}`;

  if (isFileProtocol) {
    // In Electron file:// mode, use hash-based routing
    // Convert /login to #/login
    if (!url.startsWith('#')) {
      url = `#${url}`;
    }
  }

  if (opts?.replace) {
    window.history.replaceState({}, "", url);
  } else {
    window.history.pushState({}, "", url);
  }
  window.dispatchEvent(new PopStateEvent("popstate"));
};

export const useLocation = (): LocationState => {
  const [location, setLocation] = useState<LocationState>(() => getLocation());

  useEffect(() => {
    const onChange = () => setLocation(getLocation());
    window.addEventListener("popstate", onChange);
    window.addEventListener("hashchange", onChange);
    return () => {
      window.removeEventListener("popstate", onChange);
      window.removeEventListener("hashchange", onChange);
    };
  }, []);

  return location;
};

type LinkProps = Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  "href" | "onClick"
> & {
  to: string;
  replace?: boolean;
};

export const Link: React.FC<LinkProps> = ({
  to,
  replace,
  target,
  rel,
  children,
  ...rest
}) => {
  const href = to;

  const safeRel = useMemo(() => {
    if (target !== "_blank") return rel;
    const tokens = new Set((rel || "").split(" ").filter(Boolean));
    tokens.add("noopener");
    tokens.add("noreferrer");
    return Array.from(tokens).join(" ");
  }, [rel, target]);

  const onClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (isModifiedEvent(event)) return;
      if (target && target !== "_self") return;
      if (isExternalHref(href)) return;

      event.preventDefault();
      navigate(href, { replace });
    },
    [href, replace, target]
  );

  return (
    <a href={href} onClick={onClick} target={target} rel={safeRel} {...rest}>
      {children}
    </a>
  );
};

