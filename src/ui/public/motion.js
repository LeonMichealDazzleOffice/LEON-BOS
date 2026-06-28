(function () {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
        document.documentElement.classList.add('motion-reduced');
        return;
    }

    const bodyReady = () => document.body.classList.add('motion-app-ready');

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bodyReady, { once: true });
    } else {
        bodyReady();
    }
})();
