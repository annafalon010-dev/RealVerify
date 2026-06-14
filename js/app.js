(function () {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ─── Page Loader ─── */
    function hidePageLoader() {
        const loader = document.querySelector('.page-loader');
        if (!loader) return;
        loader.classList.add('is-hidden');
        window.setTimeout(() => loader.remove(), 600);
    }

    /* ─── Hero Intro (headline + visual reveal) ─── */
    function setupHeroIntro() {
        const heroCopy = document.querySelector('.hero-copy');
        const heroVisual = document.getElementById('heroVisual');
        if (!heroCopy && !heroVisual) return;

        const reveal = () => {
            if (heroCopy) heroCopy.classList.add('is-visible');
            if (heroVisual) heroVisual.classList.add('is-revealed');
        };

        if (prefersReducedMotion) {
            reveal();
            return;
        }

        window.setTimeout(reveal, 800);
    }

    /* ─── Hero Phone Mouse Parallax ─── */
    function setupHeroPhoneParallax() {
        if (prefersReducedMotion || window.innerWidth < 768) return;

        const visual = document.getElementById('heroVisual');
        const phone = document.getElementById('heroPhone');
        if (!visual || !phone) return;

        let rafId = null;
        let targetX = 0;
        let targetY = 0;
        let currentX = 0;
        let currentY = 0;

        const onMove = (e) => {
            const rect = visual.getBoundingClientRect();
            targetX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
            targetY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
            if (!rafId) rafId = requestAnimationFrame(tick);
        };

        const onLeave = () => {
            targetX = 0;
            targetY = 0;
            if (!rafId) rafId = requestAnimationFrame(tick);
        };

        const tick = () => {
            currentX += (targetX - currentX) * 0.05;
            currentY += (targetY - currentY) * 0.05;

            const rotY = -8 + currentX * 4;
            const rotX = 4 + currentY * -3;
            phone.style.transform = `perspective(1200px) rotateY(${rotY}deg) rotateX(${rotX}deg) translateY(${currentY * -3}px)`;

            const settled = Math.abs(targetX - currentX) < 0.001 && Math.abs(targetY - currentY) < 0.001;
            if (settled && targetX === 0 && targetY === 0) {
                phone.style.transform = '';
                rafId = null;
                return;
            }
            rafId = requestAnimationFrame(tick);
        };

        visual.addEventListener('mousemove', onMove, { passive: true });
        visual.addEventListener('mouseleave', onLeave);
    }

    /* ─── Hero Stat Counters ─── */
    function setupHeroStatCounters() {
        const counters = Array.from(document.querySelectorAll('.hero-stat-reveal'));
        if (!counters.length) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting || entry.target.dataset.counted === 'true') return;
                entry.target.dataset.counted = 'true';
                animateCounter(entry.target);
            });
        }, { threshold: 0.3 });

        counters.forEach((c) => observer.observe(c));
    }

    /* ─── Navbar ─── */
    function setupNavbar() {
        const navbar = document.querySelector('.navbar');
        const toggle = document.querySelector('.nav-toggle');
        const menu = document.querySelector('.nav-menu');

        if (navbar) {
            let ticking = false;
            const updateNavbar = () => {
                navbar.classList.toggle('scrolled', window.scrollY > 40);
                ticking = false;
            };
            window.addEventListener('scroll', () => {
                if (!ticking) {
                    ticking = true;
                    requestAnimationFrame(updateNavbar);
                }
            }, { passive: true });
            updateNavbar();
        }

        if (!toggle || !menu || !navbar) return;

        const setMenuOpen = (isOpen) => {
            navbar.classList.toggle('is-open', isOpen);
            toggle.setAttribute('aria-expanded', String(isOpen));
            toggle.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
            document.body.classList.toggle('nav-open', isOpen);
        };

        toggle.addEventListener('click', () => setMenuOpen(!navbar.classList.contains('is-open')));
        menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setMenuOpen(false)));
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && navbar.classList.contains('is-open')) {
                setMenuOpen(false);
                toggle.focus();
            }
        });

        const desktopQuery = window.matchMedia('(min-width: 1101px)');
        const closeOnDesktop = () => { if (desktopQuery.matches) setMenuOpen(false); };
        desktopQuery.addEventListener?.('change', closeOnDesktop) || desktopQuery.addListener(closeOnDesktop);
    }

    /* ─── Nav Scroll Spy ─── */
    function setupNavScrollSpy() {
        const links = Array.from(document.querySelectorAll('.nav-menu a[href^="#"]'));
        const sections = links.map((link) => {
            const id = link.getAttribute('href').slice(1);
            return document.getElementById(id);
        }).filter(Boolean);

        if (!sections.length) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                const id = entry.target.id;
                links.forEach((link) => {
                    link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
                });
            });
        }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });

        sections.forEach((section) => observer.observe(section));
    }

    /* ─── Counters ─── */
    function animateCounter(element) {
        const target = Number(element.dataset.countTo || 0);
        const suffix = element.dataset.countSuffix || '';
        const prefix = element.dataset.countPrefix || '';
        const duration = Number(element.dataset.countDuration || 2400);
        if (!Number.isFinite(target)) return;

        if (prefersReducedMotion) {
            element.textContent = `${prefix}${target.toLocaleString('en-NG')}${suffix}`;
            return;
        }

        const start = performance.now();
        function tick(now) {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 4);
            const value = Math.round(target * eased);
            element.textContent = `${prefix}${value.toLocaleString('en-NG')}${suffix}`;
            if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    function setupCounters() {
        const counters = Array.from(document.querySelectorAll('[data-count-to]'));
        if (!counters.length) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting || entry.target.dataset.counted === 'true') return;
                entry.target.dataset.counted = 'true';
                animateCounter(entry.target);
            });
        }, { threshold: 0.3 });

        counters.forEach((c) => observer.observe(c));
    }

    /* ─── Scroll Reveal ─── */
    function setupRevealAnimations() {
        const selectors = '.reveal-up, .reveal-left, .reveal-right, .glass-card';
        const items = Array.from(document.querySelectorAll(selectors));
        if (!items.length) return;

        if (prefersReducedMotion) {
            items.forEach((item) => item.classList.add('is-visible'));
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting || entry.target.dataset.revealed === 'true') return;
                entry.target.dataset.revealed = 'true';
                const delay = Number(entry.target.dataset.revealDelay || 0);
                const reveal = () => {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                };
                delay > 0 ? setTimeout(reveal, delay) : reveal();
            });
        }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

        items.forEach((item, index) => {
            if (!item.dataset.revealDelay && item.classList.contains('glass-card')) {
                item.style.transitionDelay = `${Math.min(index * 0.08, 0.48)}s`;
            }
            observer.observe(item);
        });
    }

    /* ─── Testimonials Carousel ─── */
    function setupTestimonials() {
        const carousel = document.querySelector('.testimonial-carousel');
        const track = carousel?.querySelector('.testimonial-track');
        const slides = track ? Array.from(track.querySelectorAll('.testimonial-card')) : [];
        const dots = Array.from(document.querySelectorAll('.testimonial-dot'));
        if (!track || !slides.length) return;

        let activeIndex = 0;
        let autoSlide = null;

        const setSlide = (index) => {
            activeIndex = (index + slides.length) % slides.length;
            track.style.transform = `translateX(-${activeIndex * 100}%)`;
            dots.forEach((dot, idx) => dot.classList.toggle('active', idx === activeIndex));
            slides.forEach((slide, idx) => slide.classList.toggle('active', idx === activeIndex));
        };

        const startAuto = () => {
            if (prefersReducedMotion) return;
            stopAuto();
            autoSlide = setInterval(() => setSlide(activeIndex + 1), 7000);
        };

        const stopAuto = () => { if (autoSlide) { clearInterval(autoSlide); autoSlide = null; } };

        dots.forEach((dot, index) => {
            dot.addEventListener('click', () => { setSlide(index); stopAuto(); startAuto(); });
        });

        carousel.addEventListener('mouseenter', stopAuto);
        carousel.addEventListener('mouseleave', startAuto);
        setSlide(0);
        startAuto();
    }

    /* ─── Magnetic Buttons ─── */
    function setupMagneticButtons() {
        if (prefersReducedMotion) return;
        document.querySelectorAll('.magnetic').forEach((btn) => {
            btn.addEventListener('mousemove', (e) => {
                const rect = btn.getBoundingClientRect();
                const dx = e.clientX - (rect.left + rect.width / 2);
                const dy = e.clientY - (rect.top + rect.height / 2);
                btn.style.transform = `translate(${dx * 0.12}px, ${dy * 0.12}px) scale(1.02)`;
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.transform = '';
            });
        });
    }

    /* ─── Back to Top ─── */
    function setupBackToTop() {
        const button = document.querySelector('.back-to-top');
        if (!button) return;
        const update = () => button.classList.toggle('is-visible', window.scrollY > 500);
        button.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
        window.addEventListener('scroll', update, { passive: true });
        update();
    }

    /* ─── Auth / Dashboard helpers (other pages) ─── */
    function setupPasswordToggles() {
        document.querySelectorAll('.password-toggle').forEach((button) => {
            const field = button.closest('.floating-field')?.querySelector('input');
            if (!field) return;
            button.addEventListener('click', () => {
                const isHidden = field.type === 'password';
                field.type = isHidden ? 'text' : 'password';
                button.textContent = isHidden ? 'Hide' : 'Show';
            });
        });
    }

    function setupPasswordStrength() {
        const password = document.getElementById('password');
        const strengthBar = document.getElementById('password-strength-bar');
        const strengthText = document.getElementById('password-strength-text');
        if (!password || !strengthBar || !strengthText) return;
        password.addEventListener('input', () => {
            const value = password.value;
            let score = 0;
            if (value.length >= 6) score++;
            if (value.length >= 10) score++;
            if (/[A-Z]/.test(value)) score++;
            if (/[0-9]/.test(value)) score++;
            if (/[^A-Za-z0-9]/.test(value)) score++;
            const labels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'];
            const widths = ['8%', '22%', '42%', '62%', '82%', '100%'];
            strengthBar.style.width = widths[score];
            strengthText.textContent = value ? `Password strength: ${labels[score]}` : 'Password strength will appear here';
        });
    }

    function setupDashboardSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const links = Array.from(document.querySelectorAll('.sidebar-link'));
        const sections = Array.from(document.querySelectorAll('[data-dashboard-section], [data-admin-section]'));
        const toggle = document.querySelector('.sidebar-toggle');
        if (!sidebar || !links.length || !sections.length) return;

        const setActiveSection = (sectionId) => {
            sections.forEach((section) => {
                const id = section.dataset.dashboardSection || section.dataset.adminSection;
                if (id) section.hidden = id !== sectionId;
            });
            links.forEach((link) => link.classList.toggle('active', link.dataset.section === sectionId));
        };

        links.forEach((link) => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                if (link.dataset.section) setActiveSection(link.dataset.section);
                sidebar.classList.remove('is-open');
            });
        });

        toggle?.addEventListener('click', () => sidebar.classList.toggle('is-open'));
        const defaultSection = links.find((l) => l.classList.contains('active'))?.dataset.section || links[0]?.dataset.section;
        if (defaultSection) setActiveSection(defaultSection);
    }

    /* ─── Init ─── */
    document.addEventListener('DOMContentLoaded', () => {
        setupNavbar();
        setupNavScrollSpy();
        setupCounters();
        setupRevealAnimations();
        setupTestimonials();
        setupMagneticButtons();
        setupHeroIntro();
        setupHeroPhoneParallax();
        setupHeroStatCounters();
        setupBackToTop();
        setupPasswordToggles();
        setupPasswordStrength();
        setupDashboardSidebar();
    });

    window.addEventListener('load', hidePageLoader);
    setTimeout(hidePageLoader, 2000);
})();
