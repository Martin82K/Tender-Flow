(() => {
  const search = document.getElementById('manual-search');
  const chapters = [...document.querySelectorAll('.chapter')];
  const links = [...document.querySelectorAll('#manual-nav a')];
  const status = document.getElementById('search-status');
  const nav = document.getElementById('manual-nav');
  const toggle = document.getElementById('toggle-contents');
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('cs');
  const searchable = chapters.map(chapter => normalize(chapter.textContent));
  const target = hash => {
    try { return document.getElementById(decodeURIComponent(hash.replace(/^#/, ''))); }
    catch { return null; }
  };
  const filter = () => {
    const terms = normalize(search.value.trim()).split(/\s+/).filter(Boolean);
    let count = 0;
    chapters.forEach((chapter, index) => {
      chapter.hidden = !terms.every(term => searchable[index].includes(term));
      if (!chapter.hidden) count++;
    });
    links.forEach(link => { link.hidden = Boolean(target(link.hash)?.closest('.chapter')?.hidden); });
    status.textContent = terms.length ? `Nalezené kapitoly: ${count} z ${chapters.length}` : '';
    document.getElementById('search-empty').hidden = count > 0;
  };
  search.addEventListener('input', filter);
  const clear = () => { search.value = ''; filter(); };
  document.getElementById('clear-search').addEventListener('click', () => { clear(); search.focus(); });
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open)); nav.classList.toggle('is-open', open);
  });
  const reveal = hash => {
    const element = target(hash);
    if (!element) return;
    if (element.closest('.chapter')?.hidden) clear();
    links.forEach(link => {
      if (link.hash === hash) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  };
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    reveal(link.hash);
    if (nav.contains(link)) { nav.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); }
  });
  window.addEventListener('hashchange', () => { reveal(location.hash); target(location.hash)?.scrollIntoView(); });
  reveal(location.hash);
  document.getElementById('print-manual').addEventListener('click', () => window.print());
  const dialog = document.getElementById('screenshot-dialog');
  document.querySelectorAll('a[data-screenshot]').forEach(link => link.addEventListener('click', event => {
    if (typeof dialog.showModal !== 'function') return;
    event.preventDefault();
    const image = link.querySelector('img');
    dialog.querySelector('img').src = image.src;
    dialog.querySelector('img').alt = image.alt;
    dialog.querySelector('p').textContent = image.alt;
    dialog.showModal();
  }));
  document.getElementById('close-screenshot').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
})();
