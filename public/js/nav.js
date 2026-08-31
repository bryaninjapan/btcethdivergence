/**
 * Detect the current page based on the pathname.
 * @param {string} pathname - The pathname to check (e.g., '/', '/charts.html', '/charts')
 * @returns {string | null} - Returns 'records', 'charts', 'calculator', or null for unknown pages
 */
export function detectCurrentPage(pathname) {
  // Remove trailing slash for consistent comparison
  const normalized = pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname;

  // Check exact matches
  if (normalized === '/' || normalized === '' || normalized === '/index.html') {
    return 'records';
  }
  if (normalized === '/charts' || normalized === '/charts.html') {
    return 'charts';
  }
  if (normalized === '/calculator' || normalized === '/calculator.html') {
    return 'calculator';
  }

  return null;
}

/**
 * Mark the current page's navigation link as active.
 * Removes 'active' class from all nav links, then adds it to the matching one.
 * @param {string | null} currentPage - The page identifier ('records', 'charts', 'calculator', or null)
 */
export function markActivePage(currentPage) {
  if (!currentPage) {
    // Remove active class from all nav links
    document.querySelectorAll('[data-page].nav-link').forEach((link) => {
      link.classList.remove('active');
    });
    return;
  }

  // Remove active class from all nav links
  document.querySelectorAll('[data-page].nav-link').forEach((link) => {
    link.classList.remove('active');
  });

  // Add active class to the matching link
  const activeLink = document.querySelector(`[data-page="${currentPage}"].nav-link`);
  if (activeLink) {
    activeLink.classList.add('active');
  }
}

/**
 * Initialize navigation active page detection on page load.
 * Automatically detects the current page and marks it as active.
 */
export function initNav() {
  const currentPage = detectCurrentPage(window.location.pathname);
  markActivePage(currentPage);
}

// Initialize on page load (if this script runs in the browser)
if (typeof window !== 'undefined' && document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNav);
} else if (typeof window !== 'undefined') {
  initNav();
}
