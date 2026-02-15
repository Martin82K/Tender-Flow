import { describe, expect, it } from 'vitest';
import { renderMarkdownToSafeHtml } from '../shared/contracts/markdownRender';

describe('renderMarkdownToSafeHtml', () => {
  it('sanitizuje nebezpecny obsah', () => {
    const html = renderMarkdownToSafeHtml(
      '# Titulek\n\n<script>alert(1)</script>\n\n<img src="x" onerror="alert(2)" />',
    );

    expect(html).toContain('Titulek');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('onerror');
  });
});
