/**
 * Keeps the email address out of the page source so scrapers looking for "x@y.z" find
 * nothing. The markup only carries the pieces (data-email="user|domain|tld") and a
 * readable fallback ("user at domain dot tld"); this puts the real address and the
 * mailto link together in the visitor's browser.
 */
export function revealEmails(root: ParentNode = document) {
  root.querySelectorAll<HTMLAnchorElement>('a[data-email]').forEach((link) => {
    const [user, domain, tld] = (link.dataset.email ?? '').split('|');
    if (!user || !domain || !tld) return;
    const address = `${user}@${domain}.${tld}`;
    const subject = link.dataset.subject;
    link.href = `mailto:${address}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;
    const label = link.querySelector('[data-email-text]') ?? link;
    label.textContent = address;
  });
}
