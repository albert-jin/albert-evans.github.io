// aHR0cHM6Ly9naXRodWIuY29tL2x1b3N0MjYvYWNhZGVtaWMtaG9tZXBhZ2U=
$(function () {
    lazyLoadOptions = {
        scrollDirection: 'vertical',
        effect: 'fadeIn',
        effectTime: 300,
        placeholder: "",
        onError: function(element) {
            console.log('[lazyload] Error loading ' + element.data('src'));
        },
        afterLoad: function(element) {
            if (element.is('img')) {
                // remove background-image style
                element.css('background-image', 'none');
                element.css('min-height', '0');
            } else if (element.is('div')) {
                // set the style to background-size: cover; 
                element.css('background-size', 'cover');
                element.css('background-position', 'center');
            }
        }
    }

    $('img.lazy, div.lazy:not(.always-load)').Lazy({visibleOnly: true, ...lazyLoadOptions});
    $('div.lazy.always-load').Lazy({visibleOnly: false, ...lazyLoadOptions});

    $('[data-toggle="tooltip"]').tooltip()

    var $grid = $('.grid').masonry({
        "percentPosition": true,
        "itemSelector": ".grid-item",
        "columnWidth": ".grid-sizer"
    });
    // layout Masonry after each image loads
    $grid.imagesLoaded().progress(function () {
        $grid.masonry('layout');
    });

    $(".lazy").on("load", function () {
        $grid.masonry('layout');
    });

    const newsCard = document.getElementById('news-card');
    const loadMoreBtn = document.getElementById('news-load-more');
    if (newsCard && loadMoreBtn) {
        const step = parseInt(newsCard.getAttribute('data-news-step') || '10', 10);
        if (newsCard.querySelectorAll('.news-hidden.d-none').length === 0) {
            loadMoreBtn.style.display = 'none';
        }
        loadMoreBtn.addEventListener('click', function () {
            const hiddenEntries = Array.from(newsCard.querySelectorAll('.news-hidden.d-none'));
            hiddenEntries.slice(0, step).forEach((el) => {
                el.classList.remove('d-none');
                el.removeAttribute('hidden');
            });

            const remaining = newsCard.querySelectorAll('.news-hidden.d-none').length;
            if (remaining === 0) {
                loadMoreBtn.style.display = 'none';
            }
        });
    }
})
