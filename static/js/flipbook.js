function initFlipbook(pageCount) {
    const flipbook = $('#flipbook');

    // Initialize Turn.js
    flipbook.turn({
        width: 1000,
        height: 700,
        autoCenter: true,
        duration: 1000,
        gradients: true,
        acceleration: true,
        elevation: 50,
        display: 'double',
        when: {
            turned: function (e, page) {
                updatePageDisplay(page, pageCount);
            },
            missing: function (e, pages) {
                // Potential for lazy loading here
            }
        }
    });

    // Handle viewport scrolling for zoom
    const viewport = $('#viewport');
    viewport.css({
        'overflow': 'auto',
        'display': 'block' // Change from flex to block to support scrolling when zoomed
    });

    // Wrapper for centering when not zoomed
    flipbook.wrap('<div class="flipbook-wrapper"></div>');
    $('.flipbook-wrapper').css({
        'display': 'flex',
        'justify-content': 'center',
        'align-items': 'center',
        'min-height': '100%',
        'min-width': '100%',
        'padding': '40px'
    });

    // Make responsive
    function resize() {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight - 80;

        // Mantain 4:3 aspect ratio roughly
        let width = viewportWidth * 0.9;
        let height = (width / 2) * (700 / 500); // 2-page spread aspect

        if (height > viewportHeight * 0.85) {
            height = viewportHeight * 0.85;
            width = (height * 2) * (500 / 700);
        }

        // If in single page mode, width is half
        if (flipbook.turn('display') === 'single') {
            width = width / 2;
        }

        flipbook.turn('size', width, height);
    }

    resize();
    $(window).on('resize', resize);

    // Keyboard navigation
    $(window).keydown(function (e) {
        if (e.keyCode === 37) flipbook.turn('previous');
        else if (e.keyCode === 39) flipbook.turn('next');
    });

    // Drag Swipe Navigation (Mouse & Touch)
    let startX = 0;
    let startY = 0;
    let isDragging = false;

    $(document).on('mousedown touchstart', function (e) {
        // Only trigger if not in highlighting mode and not clicking buttons/sidebar
        if ($('body').hasClass('highlighting-active')) return;
        if ($(e.target).closest('button, aside, nav, .note-indicator').length) return;

        isDragging = true;
        startX = (e.type === 'touchstart') ? e.originalEvent.touches[0].pageX : e.pageX;
        startY = (e.type === 'touchstart') ? e.originalEvent.touches[0].pageY : e.pageY;
    });

    $(document).on('mouseup touchend', function (e) {
        if (!isDragging) return;
        isDragging = false;

        const endX = (e.type === 'touchend') ? e.originalEvent.changedTouches[0].pageX : e.pageX;
        const endY = (e.type === 'touchend') ? e.originalEvent.changedTouches[0].pageY : e.pageY;

        const dx = endX - startX;
        const dy = endY - startY;
        const swipeThreshold = 50;

        if (Math.abs(dx) > swipeThreshold && Math.abs(dx) > Math.abs(dy)) {
            if (dx > 0) {
                flipbook.turn('previous');
            } else {
                flipbook.turn('next');
            }
        }
    });



    // Load initial data
    loadNotes();
    loadHighlights();

    // Init Highlighter Drawing
    initHighlighterDrawing();
}

function updatePageDisplay(page, total) {
    const display = document.getElementById('page-display');
    if (!display) return;

    let range = '';
    if (page === 1) {
        range = '1';
    } else if (page === total && total % 2 === 0) {
        range = `${page - 1}-${page}`;
    } else if (page % 2 === 0) {
        range = `${page}-${Math.min(page + 1, total)}`;
    } else {
        range = `${page - 1}-${page}`;
    }

    display.textContent = `${range} of ${total}`;

    // Update notes list for current page if sidebar is open
    if ($('#sidebar').hasClass('open') && $('#sidebar-notes').is(':visible')) {
        renderNotes();
    }
}

// Sidebar Tab Management
function showSidebarTab(tab) {
    const tabs = ['toc', 'notes'];
    tabs.forEach(t => {
        if (t === tab) {
            $(`#sidebar-${t}`).removeClass('hidden');
            $(`#tab-${t}`).removeClass('bg-slate-50 text-slate-400 border-transparent').addClass('bg-blue-50 text-blue-600 border-blue-100');
        } else {
            $(`#sidebar-${t}`).addClass('hidden');
            $(`#tab-${t}`).removeClass('bg-blue-50 text-blue-600 border-blue-100').addClass('bg-slate-50 text-slate-400 border-transparent');
        }
    });

    if (tab === 'notes') renderNotes();
}

// Notes Logic
let allNotes = [];
function loadNotes() {
    const bookId = $('#flipbook').data('book-id');
    $.get(`/api/notes/${bookId}`, function (data) {
        allNotes = data;
        updateNoteIndicators();
    });
}

function renderNotes() {
    const currentPage = $('#flipbook').turn('page');
    const container = $('#notes-list');
    container.empty();

    const pageNotes = allNotes.filter(n => n.page === currentPage);

    if (pageNotes.length === 0) {
        container.append('<p class="text-xs text-slate-400 italic">No notes for this page.</p>');
    } else {
        pageNotes.forEach(note => {
            container.append(`
                <div class="note-item p-3 bg-amber-50 border border-amber-100 rounded-xl relative group">
                    <p class="text-sm text-slate-700 whitespace-pre-wrap">${note.content}</p>
                    <button onclick="deleteNote(${note.id})" class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                    <p class="text-[9px] text-slate-400 mt-2">${new Date(note.created_at).toLocaleDateString()}</p>
                </div>
            `);
        });
    }
}

function addNote() {
    $('#note-editor').removeClass('hidden');
    $('#note-content').focus();
}

function cancelNote() {
    $('#note-editor').addClass('hidden');
    $('#note-content').val('');
}

function saveNote() {
    const content = $('#note-content').val().trim();
    if (!content) return;

    const bookId = $('#flipbook').data('book-id');
    const currentPage = $('#flipbook').turn('page');

    $.ajax({
        url: `/api/notes/${bookId}`,
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            page: currentPage,
            content: content
        }),
        success: function (response) {
            allNotes.push({
                id: response.id,
                page: currentPage,
                content: content,
                created_at: new Date().toISOString()
            });
            renderNotes();
            cancelNote();
            updateNoteIndicators();
        }
    });
}

function deleteNote(id) {
    if (!confirm('Delete this note?')) return;
    $.ajax({
        url: `/api/notes/${id}`,
        type: 'DELETE',
        success: function () {
            allNotes = allNotes.filter(n => n.id !== id);
            renderNotes();
            updateNoteIndicators();
        }
    });
}

function updateNoteIndicators() {
    $('.note-indicator').remove();
    const pagesWithNotes = [...new Set(allNotes.map(n => n.page))];
    pagesWithNotes.forEach(page => {
        const pageElem = $(`.page:nth-child(${page})`);
        pageElem.append(`<div class="note-indicator" onclick="showSidebarTab('notes'); if(!$('#sidebar').hasClass('open')) toggleSidebar(); event.stopPropagation();"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg></div>`);
    });
}

// Highlighter Logic
let isHighlighting = false;
let currentHighlights = {}; // page -> [rects]

function toggleHighlighter() {
    isHighlighting = !isHighlighting;
    $('body').toggleClass('highlighting-active', isHighlighting);
    $('#btn-highlighter').toggleClass('btn-active', isHighlighting);

    if (isHighlighting) {
        // Disable turn.js dragging while highlighting
        $('#flipbook').turn('disable', true);
    } else {
        $('#flipbook').turn('disable', false);
    }
}

function loadHighlights() {
    const bookId = $('#flipbook').data('book-id');
    $.get(`/api/highlights/${bookId}`, function (data) {
        data.forEach(h => {
            currentHighlights[h.page] = h.rects;
            renderHighlights(h.page);
        });
    });
}

function renderHighlights(page) {
    const layer = $(`.highlight-layer[data-page="${page}"]`);
    layer.find('.highlight-rect').remove();

    const rects = currentHighlights[page] || [];
    rects.forEach(rect => {
        layer.append(`
            <div class="highlight-rect" style="left: ${rect.x * 100}%; top: ${rect.y * 100}%; width: ${rect.w * 100}%; height: ${rect.h * 100}%;"></div>
        `);
    });
}

function initHighlighterDrawing() {
    let startX, startY;
    let isDrawing = false;
    let currentRect = null;

    $('.highlight-layer').on('mousedown touchstart', function (e) {
        if (!isHighlighting) return;
        isDrawing = true;

        const offset = $(this).offset();
        const clientX = e.type === 'touchstart' ? e.originalEvent.touches[0].clientX : e.clientX;
        const clientY = e.type === 'touchstart' ? e.originalEvent.touches[0].clientY : e.clientY;

        startX = (clientX - offset.left) / $(this).width();
        startY = (clientY - offset.top) / $(this).height();

        currentRect = $('<div class="highlight-rect"></div>').appendTo($(this));
    });

    $(window).on('mousemove touchmove', function (e) {
        if (!isDrawing || !currentRect) return;

        const layer = currentRect.parent();
        const offset = layer.offset();
        const clientX = e.type === 'touchmove' ? e.originalEvent.touches[0].clientX : e.clientX;
        const clientY = e.type === 'touchmove' ? e.originalEvent.touches[0].clientY : e.clientY;

        const currentX = (clientX - offset.left) / layer.width();
        const currentY = (clientY - offset.top) / layer.height();

        const x = Math.min(startX, currentX);
        const y = Math.min(startY, currentY);
        const w = Math.abs(currentX - startX);
        const h = Math.abs(currentY - startY);

        currentRect.css({
            left: (x * 100) + '%',
            top: (y * 100) + '%',
            width: (w * 100) + '%',
            height: (h * 100) + '%'
        });
    });

    $(window).on('mouseup touchend', function () {
        if (!isDrawing || !currentRect) return;
        isDrawing = false;

        const layer = currentRect.parent();
        const page = layer.data('page');

        const rect = {
            x: parseFloat(currentRect.css('left')) / 100,
            y: parseFloat(currentRect.css('top')) / 100,
            w: parseFloat(currentRect.css('width')) / 100,
            h: parseFloat(currentRect.css('height')) / 100
        };

        if (rect.w < 0.01 || rect.h < 0.01) {
            currentRect.remove();
        } else {
            if (!currentHighlights[page]) currentHighlights[page] = [];
            currentHighlights[page].push(rect);
            saveHighlights(page);
        }
        currentRect = null;
    });
}

function saveHighlights(page) {
    const bookId = $('#flipbook').data('book-id');
    $.ajax({
        url: `/api/highlights/${bookId}`,
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            page: page,
            rects: currentHighlights[page]
        })
    });
}

function prevPage() { $('#flipbook').turn('previous'); }
function nextPage() { $('#flipbook').turn('next'); }
function goToPage(p) { $('#flipbook').turn('page', parseInt(p)); }

function toggleSidebar() {
    $('#sidebar').toggleClass('open');
    $('#sidebar-overlay').toggleClass('open');
}

let currentScale = 1;
function zoomIn() {
    currentScale += 0.2;
    updateZoom();
}

function zoomOut() {
    if (currentScale > 0.6) {
        currentScale -= 0.2;
        updateZoom();
    }
}

function updateZoom() {
    const flipbook = $('#flipbook');
    flipbook.css('transform', `scale(${currentScale})`);

    // Adjust wrapper height to allow scrolling
    const wrapper = $('.flipbook-wrapper');
    if (currentScale > 1) {
        wrapper.css('padding', (40 * currentScale) + 'px');
    } else {
        wrapper.css('padding', '40px');
    }
}

function toggleDisplayMode() {
    const flipbook = $('#flipbook');
    const currentDisplay = flipbook.turn('display');
    const newDisplay = currentDisplay === 'double' ? 'single' : 'double';

    flipbook.turn('display', newDisplay);

    // Update UI toggle
    const toggle = $('#display-toggle');
    const knob = toggle.find('div');
    if (newDisplay === 'single') {
        toggle.removeClass('bg-blue-600').addClass('bg-slate-300');
        knob.removeClass('right-0.5').addClass('left-0.5');
    } else {
        toggle.removeClass('bg-slate-300').addClass('bg-blue-600');
        knob.removeClass('left-0.5').addClass('right-0.5');
    }

    // Force resize
    $(window).trigger('resize');
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}
