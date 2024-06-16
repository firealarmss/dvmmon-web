document.addEventListener('DOMContentLoaded', () => {
    const themeToggleBtn = document.getElementById('theme-toggle');
    const currentTheme = localStorage.getItem('theme') || 'light';

    if (currentTheme === 'dark') {
        document.body.classList.add('dark-mode');
        themeToggleBtn.innerText = 'Toggle Light Mode';
    } else {
        themeToggleBtn.innerText = 'Toggle Dark Mode';
    }

    themeToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');

        if (document.body.classList.contains('dark-mode')) {
            localStorage.setItem('theme', 'dark');
            themeToggleBtn.innerText = 'Toggle Light Mode';
        } else {
            localStorage.setItem('theme', 'light');
            themeToggleBtn.innerText = 'Toggle Dark Mode';
        }
    });
});