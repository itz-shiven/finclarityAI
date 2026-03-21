(function() {
    const theme = localStorage.getItem('theme') || 'light';
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    }

    document.addEventListener('DOMContentLoaded', () => {
        const toggleBtns = document.querySelectorAll('#themeToggleBtn, .theme-toggle');
        
        const updateToggles = (isDark) => {
            toggleBtns.forEach(btn => {
                const icon = btn.querySelector('i');
                if (icon) {
                    if (isDark) {
                        icon.classList.remove('fa-moon');
                        icon.classList.add('fa-sun');
                    } else {
                        icon.classList.remove('fa-sun');
                        icon.classList.add('fa-moon');
                    }
                }
            });
        };

        const currentTheme = document.documentElement.getAttribute('data-theme');
        updateToggles(currentTheme === 'dark');

        toggleBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
                const newTheme = isDark ? 'light' : 'dark';
                
                document.documentElement.setAttribute('data-theme', newTheme);
                localStorage.setItem('theme', newTheme);
                updateToggles(newTheme === 'dark');
                
                // For dashboard.js compatibility if it uses class on body
                if (newTheme === 'dark') {
                    document.body.classList.add('dark-theme');
                } else {
                    document.body.classList.remove('dark-theme');
                }
            });
        });
    });
})();
