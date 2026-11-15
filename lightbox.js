// Shared photo lightboxes for the marketing pages (index, about).
//  - Any .lightbox-overlay closes on backdrop click, [data-lightbox-close], or Esc.
//  - openLightbox(id, opener) opens one by id (used by the clamp example on index).
//  - A container with data-lightbox-gallery="<lightbox id>" turns each of its
//    <button> children into a photo that opens in that lightbox, with prev/next,
//    arrow keys and an "n / N" counter. Add data-captions to also show each
//    photo's alt text as its caption.
(function () {
    let returnFocus = null;

    function openLightbox(id, opener) {
        returnFocus = opener || document.activeElement;
        const box = document.getElementById(id);
        box.style.display = 'flex';
        document.documentElement.classList.add('lightbox-open');
        box.querySelector('[data-lightbox-close]').focus();
    }

    function closeLightbox(box) {
        box.style.display = 'none';
        document.documentElement.classList.remove('lightbox-open');
        if (returnFocus) returnFocus.focus();
    }

    function openBox() {
        return [...document.querySelectorAll('.lightbox-overlay')].find(b => b.style.display === 'flex');
    }

    document.querySelectorAll('.lightbox-overlay').forEach(box => {
        box.addEventListener('click', e => {
            if (e.target === box || e.target.closest('[data-lightbox-close]')) closeLightbox(box);
        });
    });

    const galleries = new Map(); // lightbox element -> step(delta)

    document.querySelectorAll('[data-lightbox-gallery]').forEach(gallery => {
        const box = document.getElementById(gallery.dataset.lightboxGallery);
        const items = [...gallery.querySelectorAll('button')];
        const img = box.querySelector('.lightbox-img');
        const count = box.querySelector('.lightbox-count');
        const caption = box.querySelector('.lightbox-text');
        const showCaptions = gallery.hasAttribute('data-captions');
        let index = 0;

        function show(i) {
            index = (i + items.length) % items.length;
            const src = items[index].querySelector('img');
            img.src = src.getAttribute('src');
            img.alt = src.alt;
            count.textContent = `${index + 1} / ${items.length}`;
            if (caption) caption.textContent = showCaptions ? src.alt : '';
        }

        items.forEach((item, i) => item.addEventListener('click', () => {
            show(i);
            openLightbox(box.id, item);
        }));
        box.querySelector('.lightbox-prev').addEventListener('click', () => show(index - 1));
        box.querySelector('.lightbox-next').addEventListener('click', () => show(index + 1));
        galleries.set(box, d => show(index + d));
    });

    document.addEventListener('keydown', e => {
        const box = openBox();
        if (!box) return;
        if (e.key === 'Escape') closeLightbox(box);
        else if (galleries.has(box) && e.key === 'ArrowLeft') galleries.get(box)(-1);
        else if (galleries.has(box) && e.key === 'ArrowRight') galleries.get(box)(1);
    });

    window.openLightbox = openLightbox;
})();
