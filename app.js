const menuButton = document.querySelector('.menu-toggle');
const menu = document.querySelector('.mobile-menu');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const desktopHeaderQuery = window.matchMedia('(min-width: 741px)');

function syncResponsiveHeader() {
  const header = document.querySelector('.site-header');
  if (desktopHeaderQuery.matches) header.setAttribute('hidden', '');
  else header.removeAttribute('hidden');
}

const darkMenuSurfaces = ['.project-rail', '.sector-ticker', '.showreel', '.capabilities', '.contact'];

function syncMenuTone() {
  if (!menuButton || desktopHeaderQuery.matches) return;
  const fixedMenuY = 42;
  const onDarkSurface = menu.classList.contains('open') || darkMenuSurfaces.some((selector) => {
    return [...document.querySelectorAll(selector)].some((element) => {
      const rect = element.getBoundingClientRect();
      return rect.top <= fixedMenuY && rect.bottom > fixedMenuY;
    });
  });
  menuButton.classList.toggle('is-light', onDarkSurface);
}

syncResponsiveHeader();
desktopHeaderQuery.addEventListener('change', syncResponsiveHeader);
window.addEventListener('scroll', syncMenuTone, { passive: true });
window.addEventListener('resize', syncMenuTone);

window.addEventListener('load', () => {
  const previewSection = new URLSearchParams(window.location.search).get('section');
  const selector = previewSection ? `#${previewSection}` : window.location.hash;
  if (!selector) return;
  const target = document.querySelector(selector);
  if (target) window.setTimeout(() => target.scrollIntoView({ block: 'start' }), 80);
});

function setMenu(open) {
  document.body.classList.toggle('menu-open', open);
  menu.classList.toggle('open', open);
  menu.setAttribute('aria-hidden', String(!open));
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.querySelector('span').textContent = open ? 'Close' : 'Menu';
  syncMenuTone();
}

menuButton.addEventListener('click', () => setMenu(!menu.classList.contains('open')));
menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setMenu(false)));
syncMenuTone();
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') setMenu(false);
});

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in-view');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));

function playMutedVideo(video) {
  if (!video) return Promise.resolve();
  video.muted = true;
  video.defaultMuted = true;
  return video.play().catch(() => {});
}

const workCarousel = document.querySelector('[data-work-carousel]');

if (workCarousel) {
  const cards = [...workCarousel.querySelectorAll('[data-work-slide]')];
  const videos = cards.map((card) => card.querySelector('video'));
  const track = workCarousel.querySelector('.work-carousel-track');
  const intro = workCarousel.querySelector('.work-carousel-intro');
  const currentLabel = workCarousel.querySelector('[data-work-current]');
  const desktopCarousel = window.matchMedia('(min-width: 741px)');
  let activeIndex = -1;
  let activeVisible = false;
  let activePlaying = false;
  let frameRequested = false;
  let targetPosition = 0;
  let renderedPosition = 0;

  function carouselClearance() {
    const isMobile = !desktopCarousel.matches;
    const introBottom = isMobile ? intro.getBoundingClientRect().bottom - track.getBoundingClientRect().top : 0;
    return {
      top: isMobile ? Math.max(12, introBottom + 12) : 12,
      bottom: isMobile ? 42 : 20
    };
  }

  function fitWorkCarouselCards() {
    cards.forEach((card) => { card.style.width = ''; });
    const baseWidth = Math.min(...cards.map((card) => card.offsetWidth));
    const captionHeight = Math.max(...cards.map((card) => card.querySelector('.work-caption').offsetHeight));
    const { top, bottom } = carouselClearance();
    const availableHeight = Math.max(0, track.clientHeight - top - bottom);
    const heightFitWidth = Math.max(100, (availableHeight - captionHeight) * 9 / 16);
    const mobileWidth = Math.min(track.clientWidth * 0.72, 292);
    const width = Math.floor(Math.min(desktopCarousel.matches ? baseWidth : mobileWidth, heightFitWidth));
    cards.forEach((card) => { card.style.width = `${width}px`; });
  }

  function setActiveVideo(nextIndex, sectionVisible, shouldPlay = sectionVisible) {
    const nextPlaying = sectionVisible && shouldPlay;
    if (activeIndex === nextIndex && activeVisible === sectionVisible && activePlaying === nextPlaying) {
      if (nextPlaying && videos[nextIndex].paused) playMutedVideo(videos[nextIndex]);
      return;
    }
    activeIndex = nextIndex;
    activeVisible = sectionVisible;
    activePlaying = nextPlaying;
    cards.forEach((card, index) => {
      const isActive = sectionVisible && index === nextIndex;
      card.classList.toggle('is-active', isActive);
      card.setAttribute('aria-hidden', String(!isActive));
      card.querySelector('a').tabIndex = isActive ? 0 : -1;
      if (isActive && nextPlaying) playMutedVideo(videos[index]);
      else videos[index].pause();
    });
    currentLabel.textContent = String(nextIndex + 1).padStart(2, '0');
  }

  function measureWorkCarousel() {
    const rect = workCarousel.getBoundingClientRect();
    const sectionVisible = rect.bottom > 0 && rect.top < window.innerHeight;
    const scrollableDistance = Math.max(workCarousel.offsetHeight - window.innerHeight, 1);
    const progress = Math.min(1, Math.max(0, -rect.top / scrollableDistance));
    targetPosition = progress * (cards.length - 1);
    requestWorkCarouselRender();
  }

  function renderWorkCarousel() {
    frameRequested = false;
    const rect = workCarousel.getBoundingClientRect();
    const sectionVisible = rect.bottom > 0 && rect.top < window.innerHeight;
    const delta = targetPosition - renderedPosition;
    const easing = desktopCarousel.matches ? 0.18 : 0.13;
    renderedPosition = reducedMotion || Math.abs(delta) < 0.001 ? targetPosition : renderedPosition + delta * easing;
    const position = renderedPosition;
    const nextIndex = Math.round(position);
    const isMobile = !desktopCarousel.matches;
    const ringRadius = isMobile ? Math.min(track.clientWidth * 0.68, 296) : Math.min(track.clientWidth * 0.39, 300);
    const angleStep = isMobile ? 52 : 72;
    const { top, bottom } = carouselClearance();
    const baseCenterY = track.clientHeight * (isMobile ? 0.6 : 0.47);

    cards.forEach((card, index) => {
      const rawOffset = index - position;
      const half = cards.length / 2;
      const offset = ((rawOffset + half) % cards.length + cards.length) % cards.length - half;
      const angle = offset * angleStep;
      const radians = angle * Math.PI / 180;
      const depth = Math.cos(radians);
      const x = Math.sin(radians) * ringRadius;
      const y = (1 - depth) * (isMobile ? 10 : 32);
      const z = (depth - 1) * ringRadius;
      const scale = isMobile ? 0.74 + Math.max(depth, 0) * 0.26 : 0.78 + Math.max(depth, 0) * 0.22;
      const centeredX = x - card.offsetWidth / 2;
      const halfHeight = card.offsetHeight / 2;
      const lowestCenter = track.clientHeight - bottom - halfHeight;
      const preferredCenterY = isMobile ? (top + halfHeight + lowestCenter) / 2 + y : baseCenterY + y;
      const centerY = Math.min(Math.max(preferredCenterY, top + halfHeight), lowestCenter);
      const centeredY = centerY - baseCenterY - halfHeight;
      card.style.transform = `translate3d(${centeredX}px, ${centeredY}px, ${z}px) rotateY(${angle}deg) scale(${scale})`;
      card.style.opacity = String(Math.max(0.32, 0.6 + depth * 0.4));
      card.style.zIndex = String(50 + Math.round(depth * 20));
      card.style.pointerEvents = Math.abs(offset) < 0.5 ? 'auto' : 'none';
    });

    const activeRawOffset = nextIndex - position;
    const activeOffset = ((activeRawOffset + cards.length / 2) % cards.length + cards.length) % cards.length - cards.length / 2;
    const playThreshold = desktopCarousel.matches ? 0.2 : 0.65;
    setActiveVideo(nextIndex, sectionVisible, Math.abs(activeOffset) < playThreshold);
    if (Math.abs(targetPosition - renderedPosition) >= 0.001) requestWorkCarouselRender();
  }

  function requestWorkCarouselRender() {
    if (frameRequested) return;
    frameRequested = true;
    window.requestAnimationFrame(renderWorkCarousel);
  }

  window.addEventListener('scroll', measureWorkCarousel, { passive: true });
  window.addEventListener('resize', () => { fitWorkCarouselCards(); measureWorkCarousel(); });
  track.addEventListener('scroll', measureWorkCarousel, { passive: true });
  desktopCarousel.addEventListener('change', () => { fitWorkCarouselCards(); measureWorkCarousel(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') measureWorkCarousel();
    else videos.forEach((video) => video.pause());
  });
  fitWorkCarouselCards();
  measureWorkCarousel();
  document.fonts?.ready.then(() => { fitWorkCarouselCards(); measureWorkCarousel(); });
}

const showreel = document.querySelector('.showreel video');
if (showreel) {
  showreel.muted = true;
  showreel.defaultMuted = true;
  showreel.loop = true;
  showreel.playsInline = true;
  showreel.addEventListener('canplay', () => playMutedVideo(showreel));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') playMutedVideo(showreel);
  });
  playMutedVideo(showreel);
}

const cursor = document.querySelector('.cursor-dot');
if (window.matchMedia('(pointer:fine)').matches) {
  window.addEventListener('pointermove', (event) => {
    cursor.style.opacity = '1';
    cursor.style.left = `${event.clientX}px`;
    cursor.style.top = `${event.clientY}px`;
  });
}

document.querySelector('[data-year]').textContent = new Date().getFullYear();

const projectData = {
  fnb: {
    index: '01',
    category: 'F&B',
    title: 'Food that moves.',
    client: 'One Stop · Gota',
    services: 'Strategy · Food film · Social',
    video: '/media/350e255be2226ad4e771ed2e.mp4',
    poster: '/assets/rail-gota-clean-final-v3.png',
    description: 'From the first pour to the final bite, we make food and beverage content feel immediate. Bold concepts, appetite-led filmmaking and social systems designed to turn attention into action.'
  },
  campaigns: {
    index: '02',
    category: 'Brand campaigns',
    title: 'Big ideas. Built to travel.',
    client: 'Trendy campaign partners',
    services: 'Concept · Production · Rollout',
    video: '/media/cc0d02b5722e10acb1516583.mp4',
    poster: '/assets/rail-film-clean-final-v3.png',
    description: 'A single sharp idea, carried across every format. We shape campaign platforms, direct the production and build the social rollout so each launch lands as one connected story.'
  },
  corporate: {
    index: '03',
    category: 'Corporate',
    title: 'Driven by detail.',
    client: 'Denza Qatar',
    services: 'Story · Film · Campaign content',
    video: '/media/d52bb18e55cc3d9dbb8885b1.mp4',
    poster: '/assets/rail-corporate-clean-final-v3.png',
    description: 'Corporate does not have to feel corporate. We translate product, people and purpose into confident films and social content with clarity, pace and character.'
  },
  lifestyle: {
    index: '04',
    category: 'Lifestyle',
    title: 'Culture, styled forward.',
    client: 'Sada',
    services: 'Art direction · Film · Social',
    video: '/media/eb5aa81baf629d2062c653db.mp4',
    poster: '/assets/rail-saada-clean-final-v3.png',
    description: 'Editorial art direction meets the pace of social. We build visually distinct worlds for fashion, hospitality and lifestyle brands while keeping every frame rooted in local culture.'
  },
  automotive: {
    index: '05',
    category: 'Automotive',
    title: 'Built to move.',
    client: 'Denza · Jetour',
    services: 'Campaign concept · Film · Social',
    video: '/media/d52bb18e55cc3d9dbb8885b1.mp4',
    poster: '/assets/rail-automotive-denza-jetour-v1.png',
    description: 'Premium automotive content with presence, pace and precision. From cinematic product films to always-on social, we give every model a distinct visual identity built for attention.'
  }
};

const projectOverlay = document.querySelector('[data-project-overlay]');
const drawerVideo = document.querySelector('[data-drawer-video]');
const drawerMedia = document.querySelector('.drawer-media');
const drawerDual = document.querySelector('.drawer-dual');
let projectTrigger = null;

function closeProject() {
  projectOverlay.classList.remove('open');
  projectOverlay.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('drawer-open');
  drawerVideo.pause();
  if (projectTrigger) projectTrigger.focus({ preventScroll: true });
}

function openProject(key, trigger) {
  const project = projectData[key];
  if (!project) return;
  projectTrigger = trigger;
  document.querySelector('[data-drawer-index]').textContent = project.index;
  document.querySelector('[data-drawer-category]').textContent = project.category;
  document.querySelector('[data-drawer-title]').textContent = project.title;
  document.querySelector('[data-drawer-client]').textContent = project.client;
  document.querySelector('[data-drawer-services]').textContent = project.services;
  document.querySelector('[data-drawer-description]').textContent = project.description;
  const isDual = key === 'fnb';
  drawerMedia.classList.toggle('is-dual', isDual);
  drawerDual.setAttribute('aria-hidden', String(!isDual));
  drawerMedia.style.setProperty('--poster', `url('${project.poster}')`);
  if (isDual) {
    drawerVideo.pause();
    drawerVideo.removeAttribute('src');
    drawerVideo.load();
  } else {
    drawerVideo.poster = project.poster;
    drawerVideo.src = project.video;
  }
  projectOverlay.classList.add('open');
  projectOverlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('drawer-open');
  projectOverlay.querySelector('.drawer-close').focus();
  if (!isDual) playMutedVideo(drawerVideo);
}

document.querySelectorAll('[data-project]').forEach((trigger) => {
  trigger.addEventListener('click', (event) => {
    event.preventDefault();
    openProject(trigger.dataset.project, trigger);
  });
});
document.querySelectorAll('[data-project-close]').forEach((button) => button.addEventListener('click', closeProject));
document.addEventListener('keydown', (event) => {
  if (!projectOverlay.classList.contains('open')) return;
  if (event.key === 'Escape') closeProject();
  if (event.key === 'Tab') {
    const focusable = [...projectOverlay.querySelectorAll('button, a[href]')].filter((element) => !element.hasAttribute('disabled'));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});

const initialProject = new URLSearchParams(window.location.search).get('project');
if (projectData[initialProject]) {
  window.addEventListener('load', () => openProject(initialProject, document.querySelector(`[data-project="${initialProject}"]`)));
}

const contactForm = document.querySelector('#contact-form');
const contactStatus = document.querySelector('[data-contact-status]');
const contactOverlay = document.querySelector('[data-contact-overlay]');
let contactTrigger = null;

function openContact(trigger) {
  contactTrigger = trigger;
  const intent = trigger?.dataset.contactIntent;
  if (intent && contactForm.elements.requestType) {
    contactForm.elements.requestType.value = intent;
    contactForm.elements.requestType.dispatchEvent(new Event('change'));
  }
  const requestLabel = intent === 'audit' ? 'Request a brand audit.' : intent === 'meeting' ? 'Book a discovery meeting.' : 'Tell us what\nyou’re building.';
  document.querySelector('#contact-dialog-title').textContent = requestLabel;
  contactOverlay.classList.add('open');
  contactOverlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('contact-open');
  contactOverlay.querySelector('.contact-dialog').scrollTop = 0;
  window.setTimeout(() => contactForm.elements.name.focus(), 80);
}

function closeContact() {
  contactOverlay.classList.remove('open');
  contactOverlay.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('contact-open');
  if (contactTrigger) contactTrigger.focus({ preventScroll: true });
}

if (contactForm) {
  const phoneCountry = contactForm.elements.phoneCountry;
  const phoneInput = contactForm.elements.phone;

  function enhanceSelect(select) {
    const field = select.parentElement;
    const control = document.createElement('div');
    const button = document.createElement('button');
    const menu = document.createElement('div');
    const label = document.createElement('span');
    const chevron = document.createElement('i');
    const menuId = `${select.name}-options`;

    control.className = 'custom-select';
    button.className = 'custom-select-trigger';
    button.type = 'button';
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', menuId);
    button.append(label, chevron);
    menu.className = 'custom-select-menu';
    menu.id = menuId;
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-label', select.closest('label')?.querySelector('span')?.textContent || select.name);

    [...select.options].forEach((option) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'custom-select-option';
      item.textContent = option.textContent;
      item.dataset.value = option.value;
      item.setAttribute('role', 'option');
      item.addEventListener('click', () => {
        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        button.focus();
        close();
      });
      menu.append(item);
    });

    function sync() {
      const option = select.options[select.selectedIndex];
      label.textContent = option.textContent;
      [...menu.children].forEach((item) => {
        const selected = item.dataset.value === option.value;
        item.classList.toggle('is-selected', selected);
        item.setAttribute('aria-selected', String(selected));
      });
    }
    function close() {
      control.classList.remove('is-open');
      button.setAttribute('aria-expanded', 'false');
    }
    function positionMenu() {
      const bounds = button.getBoundingClientRect();
      const spaceAbove = bounds.top;
      const spaceBelow = window.innerHeight - bounds.bottom;
      const menuHeight = Math.min(menu.scrollHeight + 8, 280);
      const openUpward = spaceBelow < menuHeight && spaceAbove > spaceBelow;
      control.classList.toggle('opens-upward', openUpward);
      const availableSpace = (openUpward ? spaceAbove : spaceBelow) - 16;
      menu.style.maxHeight = `${Math.max(132, Math.min(280, availableSpace))}px`;
    }
    button.addEventListener('click', () => {
      const opening = !control.classList.contains('is-open');
      document.querySelectorAll('.custom-select.is-open').forEach((item) => item.classList.remove('is-open'));
      if (opening) positionMenu();
      control.classList.toggle('is-open', opening);
      button.setAttribute('aria-expanded', String(opening));
    });
    select.addEventListener('change', sync);
    document.addEventListener('pointerdown', (event) => { if (!control.contains(event.target)) close(); });
    window.addEventListener('resize', () => { if (control.classList.contains('is-open')) positionMenu(); });
    select.classList.add('native-select');
    select.tabIndex = -1;
    control.append(select, button, menu);
    field?.append(control);
    sync();
  }

  contactForm.querySelectorAll('select.branded-select').forEach(enhanceSelect);

  function syncPhoneCountry() {
    const option = phoneCountry.options[phoneCountry.selectedIndex];
    const min = Number(option.dataset.min || 7);
    const max = Number(option.dataset.max || 30);
    phoneInput.removeAttribute('minlength');
    phoneInput.removeAttribute('maxlength');
    phoneInput.minLength = min;
    phoneInput.maxLength = max;
    phoneInput.placeholder = option.dataset.placeholder || '';
    phoneInput.setAttribute('aria-label', `Phone number for ${option.textContent}`);
  }

  phoneCountry.addEventListener('change', syncPhoneCountry);
  syncPhoneCountry();

  document.querySelectorAll('[data-contact-open], .work-card a').forEach((trigger) => {
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      openContact(trigger);
    });
  });
  document.querySelectorAll('[data-contact-close]').forEach((button) => button.addEventListener('click', closeContact));

  document.addEventListener('keydown', (event) => {
    if (!contactOverlay.classList.contains('open')) return;
    if (event.key === 'Escape') closeContact();
    if (event.key === 'Tab') {
      const focusable = [...contactOverlay.querySelectorAll('button, input, select, textarea')].filter((element) => !element.disabled && element.tabIndex !== -1);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  contactForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!contactForm.reportValidity()) return;

    const submitButton = contactForm.querySelector('button[type="submit"]');
    const submitLabel = submitButton.querySelector('span');
    submitButton.disabled = true;
    submitLabel.textContent = 'Sending';
    contactStatus.textContent = '';
    contactStatus.classList.remove('is-error', 'is-success');

    try {
      const response = await fetch(contactForm.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(contactForm)))
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Please check the form and try again.');
      contactForm.reset();
      syncPhoneCountry();
      contactStatus.textContent = result.message;
      contactStatus.classList.add('is-success');
    } catch (error) {
      contactStatus.textContent = error.message || 'Something went wrong. Email info@trendymedia.org instead.';
      contactStatus.classList.add('is-error');
    } finally {
      submitButton.disabled = false;
      submitLabel.textContent = 'Send the brief';
    }
  });
}
