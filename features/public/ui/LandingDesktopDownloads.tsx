import React from "react";
import {
  DESKTOP_DOWNLOADS,
  DESKTOP_RELEASES_LATEST_URL,
} from "@features/public/model/desktopDownloads";

const externalLinkProps = {
  target: "_blank",
  rel: "noopener noreferrer",
} as const;

export const LandingHeroDownloads: React.FC = () => (
  <>
    <div className="hero-actions">
      {DESKTOP_DOWNLOADS.map((item) => (
        <a
          key={item.id}
          className={item.id === "windows" ? "btn-hero-primary" : "btn-hero-secondary"}
          href={item.href}
          {...externalLinkProps}
        >
          {item.label}
        </a>
      ))}
    </div>
    <p className="hero-download-note">
      Bez přihlášení.{" "}
      <a href={DESKTOP_RELEASES_LATEST_URL} {...externalLinkProps}>
        Všechny verze na GitHubu
      </a>
    </p>
  </>
);

export const LandingDesktopSection: React.FC = () => (
  <section id="desktop" aria-labelledby="landing-desktop-title">
    <div className="container">
      <div className="sec-label">Desktop</div>
      <h2 className="sec-title" id="landing-desktop-title">
        Aplikace pro <span className="serif">Windows i macOS</span>
      </h2>
      <p className="sec-desc">
        Nativní instalátory stáhnete bez přihlášení. Web i desktop sdílejí stejná data.
      </p>
      <div className="desktop-download-grid">
        {DESKTOP_DOWNLOADS.map((item) => (
          <article key={item.id} className="desktop-download-card">
            <span className="integration-eyebrow">{item.platform}</span>
            <h3>{item.label}</h3>
            <p>{item.filename}</p>
            <a
              className="enterprise-pricing-cta"
              href={item.href}
              aria-label={item.label}
              {...externalLinkProps}
            >
              Stáhnout
            </a>
          </article>
        ))}
      </div>
      <p className="desktop-download-latest">
        <a href={DESKTOP_RELEASES_LATEST_URL} {...externalLinkProps}>
          Nejnovější vydání na GitHubu
        </a>
      </p>
    </div>
  </section>
);

export const LandingFooterDownloads: React.FC = () => (
  <>
    {DESKTOP_DOWNLOADS.map((item) => (
      <a key={item.id} href={item.href} {...externalLinkProps}>
        {item.platform}
      </a>
    ))}
    <a href={DESKTOP_RELEASES_LATEST_URL} {...externalLinkProps}>
      Všechny verze
    </a>
  </>
);
