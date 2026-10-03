// Registered on every page so returning visitors always get the network-first service worker
// (see sw.js). Failure is harmless: the site works the same, just without offline fallback.
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
        navigator.serviceWorker.register('/sw.js').catch(function () {});
    });
}
