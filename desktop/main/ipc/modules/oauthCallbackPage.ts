export type OAuthCallbackOutcome = 'success' | 'error';

export const OAUTH_CALLBACK_CONTENT_TYPE = 'text/html; charset=utf-8';

export const buildOAuthCallbackPage = (outcome: OAuthCallbackOutcome): string => {
    const success = outcome === 'success';
    const title = success ? 'Přihlášení dokončeno' : 'Přihlášení se nepodařilo';
    const message = success
        ? 'Toto okno můžete zavřít.'
        : 'Vraťte se do Tender Flow a zkuste to znovu.';

    return `<!doctype html>
<html lang="cs">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
</head>
<body>
  <main>
    <h1>${title}</h1>
    <p>${message}</p>
  </main>
</body>
</html>`;
};
