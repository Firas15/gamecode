// SIDEBAR
const sidebar      = document.getElementById('sidebar');
const overlay      = document.getElementById('overlay');
const menuBtn      = document.getElementById('menuBtn');
const sidebarClose = document.getElementById('sidebarClose');

function openSidebar() {
  sidebar.classList.add('open');
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  sidebar.classList.remove('open');
  overlay.classList.remove('active');
  document.body.style.overflow = '';
}

menuBtn.addEventListener('click', openSidebar);
sidebarClose.addEventListener('click', closeSidebar);
overlay.addEventListener('click', closeSidebar);

document.querySelectorAll('.sidebar-link').forEach(link => {
  link.addEventListener('click', closeSidebar);
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeSidebar();
});

// SCROLL REVEAL 

const observer = new IntersectionObserver(
  entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.style.animationPlayState = 'running';
        observer.unobserve(e.target);
      }
    });
  },
  { threshold: 0.1 }
);

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.game-section').forEach(el => {
    el.style.animationPlayState = 'paused';
    observer.observe(el);
  });
});
