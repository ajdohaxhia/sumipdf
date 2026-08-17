document.addEventListener('DOMContentLoaded', () => {
  const skip = document.querySelector<HTMLAnchorElement>('.sumi-skip');
  const main = document.querySelector('main');
  if (skip && main) {
    if (!main.id) main.id = 'main-content';
    skip.setAttribute('href', `#${main.id}`);
  }

  const mobileMenuButton = document.getElementById('mobile-menu-button');
  const mobileMenu = document.getElementById('mobile-menu');
  const menuIcon = document.getElementById('menu-icon');
  const closeIcon = document.getElementById('close-icon');

  if (!mobileMenuButton || !mobileMenu || !menuIcon || !closeIcon) return;

  const closeMenu = () => {
    mobileMenu.classList.add('hidden');
    menuIcon.classList.remove('hidden');
    closeIcon.classList.add('hidden');
    mobileMenuButton.setAttribute('aria-expanded', 'false');
  };

  const openMenu = () => {
    mobileMenu.classList.remove('hidden');
    menuIcon.classList.add('hidden');
    closeIcon.classList.remove('hidden');
    mobileMenuButton.setAttribute('aria-expanded', 'true');
  };

  mobileMenuButton.addEventListener('click', () => {
    const isExpanded =
      mobileMenuButton.getAttribute('aria-expanded') === 'true';
    if (isExpanded) closeMenu();
    else openMenu();
  });

  mobileMenu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => closeMenu());
  });

  document.addEventListener('click', (event) => {
    const target = event.target as Node;
    if (
      !mobileMenu.contains(target) &&
      !mobileMenuButton.contains(target) &&
      !mobileMenu.classList.contains('hidden')
    ) {
      closeMenu();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !mobileMenu.classList.contains('hidden')) {
      closeMenu();
      mobileMenuButton.focus();
    }
  });
});
