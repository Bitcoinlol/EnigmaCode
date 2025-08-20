// Landing Page JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Mobile menu toggle
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    
    if (mobileMenuToggle && navLinks) {
        mobileMenuToggle.addEventListener('click', function() {
            navLinks.classList.toggle('active');
        });
    }
    
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // Navbar background on scroll
    const navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', function() {
        if (window.scrollY > 50) {
            navbar.style.background = 'rgba(15, 15, 35, 0.98)';
        } else {
            navbar.style.background = 'rgba(15, 15, 35, 0.95)';
        }
    });
    
    // Animate hero stats on scroll
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate');
            }
        });
    }, observerOptions);
    
    // Observe elements for animation
    document.querySelectorAll('.feature-card, .pricing-card, .hero-stats').forEach(el => {
        observer.observe(el);
    });
    
    // Animate numbers in hero stats
    function animateNumber(element, target, duration = 2000) {
        const start = 0;
        const increment = target / (duration / 16);
        let current = start;
        
        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                current = target;
                clearInterval(timer);
            }
            
            // Format number based on target
            let displayValue;
            if (target >= 1000000) {
                displayValue = (current / 1000000).toFixed(1) + 'M+';
            } else if (target >= 1000) {
                displayValue = (current / 1000).toFixed(1) + 'K+';
            } else {
                displayValue = current.toFixed(1) + '%';
            }
            
            element.textContent = displayValue;
        }, 16);
    }
    
    // Trigger number animations when stats come into view
    const statsObserver = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const statNumbers = entry.target.querySelectorAll('.stat-number');
                statNumbers.forEach((stat, index) => {
                    const targets = [99.9, 10000000, 5000];
                    setTimeout(() => {
                        animateNumber(stat, targets[index]);
                    }, index * 200);
                });
                statsObserver.unobserve(entry.target);
            }
        });
    }, observerOptions);
    
    const heroStats = document.querySelector('.hero-stats');
    if (heroStats) {
        statsObserver.observe(heroStats);
    }
    
    // Code preview typing animation
    const codeLines = document.querySelectorAll('.code-line .code-text');
    let currentLine = 0;
    
    function typeCodeLine(element, text, callback) {
        element.textContent = '';
        let i = 0;
        
        const typeInterval = setInterval(() => {
            if (i < text.length) {
                element.innerHTML += text.charAt(i);
                i++;
            } else {
                clearInterval(typeInterval);
                if (callback) callback();
            }
        }, 50);
    }
    
    // Start code animation when hero comes into view
    const heroObserver = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    startCodeAnimation();
                }, 1000);
                heroObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.3 });
    
    const hero = document.querySelector('.hero');
    if (hero) {
        heroObserver.observe(hero);
    }
    
    function startCodeAnimation() {
        const originalTexts = [
            '-- Original Code',
            '<span class="keyword">local</span> <span class="variable">message</span> = <span class="string">"Hello World"</span>',
            '<span class="function">print</span>(<span class="variable">message</span>)'
        ];
        
        function animateNextLine() {
            if (currentLine < originalTexts.length && codeLines[currentLine]) {
                typeCodeLine(codeLines[currentLine], originalTexts[currentLine], () => {
                    currentLine++;
                    setTimeout(animateNextLine, 500);
                });
            }
        }
        
        animateNextLine();
    }
    
    // Particle animation for hero background
    const particles = document.querySelector('.hero-particles');
    if (particles) {
        // Create floating particles
        for (let i = 0; i < 20; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.cssText = `
                position: absolute;
                width: ${Math.random() * 4 + 1}px;
                height: ${Math.random() * 4 + 1}px;
                background: rgba(139, 92, 246, ${Math.random() * 0.5 + 0.1});
                border-radius: 50%;
                left: ${Math.random() * 100}%;
                top: ${Math.random() * 100}%;
                animation: float ${Math.random() * 10 + 10}s ease-in-out infinite;
                animation-delay: ${Math.random() * 5}s;
            `;
            particles.appendChild(particle);
        }
    }
    
    // Feature cards hover effect
    document.querySelectorAll('.feature-card').forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-10px) scale(1.02)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });
    
    // Pricing card selection
    document.querySelectorAll('.pricing-card').forEach(card => {
        card.addEventListener('click', function() {
            document.querySelectorAll('.pricing-card').forEach(c => c.classList.remove('selected'));
            this.classList.add('selected');
        });
    });
    
    // Add loading states to buttons
    document.querySelectorAll('.btn-primary, .btn-secondary').forEach(btn => {
        btn.addEventListener('click', function(e) {
            if (this.href && !this.href.includes('#')) {
                this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
                this.style.pointerEvents = 'none';
            }
        });
    });
    
    // Add CSS for animations
    const style = document.createElement('style');
    style.textContent = `
        .nav-links.active {
            display: flex !important;
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: rgba(15, 15, 35, 0.98);
            flex-direction: column;
            padding: var(--spacing-lg);
            border-top: 1px solid var(--border-color);
        }
        
        .feature-card, .pricing-card {
            opacity: 0;
            transform: translateY(20px);
            transition: all 0.6s ease;
        }
        
        .feature-card.animate, .pricing-card.animate {
            opacity: 1;
            transform: translateY(0);
        }
        
        .hero-stats {
            opacity: 0;
            transform: translateY(20px);
            transition: all 0.8s ease;
        }
        
        .hero-stats.animate {
            opacity: 1;
            transform: translateY(0);
        }
        
        .pricing-card.selected {
            border-color: var(--primary-color);
            box-shadow: var(--shadow-glow);
            transform: translateY(-5px) scale(1.02);
        }
        
        @media (max-width: 768px) {
            .nav-links {
                display: none;
            }
        }
    `;
    document.head.appendChild(style);
});
