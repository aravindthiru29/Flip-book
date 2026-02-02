document.addEventListener("DOMContentLoaded", async () => {

    const leftSheet  = document.getElementById("left-sheet");
    const rightSheet = document.getElementById("right-sheet");
    const book = document.querySelector(".book");

    const lf = document.getElementById("left-front").getContext("2d");
    const lb = document.getElementById("left-back").getContext("2d");
    const rf = document.getElementById("right-front").getContext("2d");
    const rb = document.getElementById("right-back").getContext("2d");

    const url = `/uploads/${PDF_FILE}`;
    const scale = 1.2;

    let pdfDoc;
    let totalPages;
    let currentPage = 1;

    let activeSheet = null;
    let startX = 0;
    let rotation = 0;
    let dragging = false;

    /* ---------- PDF RENDER ---------- */

    async function render(pageNum, ctx, canvas) {
        if (pageNum < 1 || pageNum > totalPages) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: ctx, viewport }).promise;
    }

    async function loadPages() {
        await render(currentPage, lf, document.getElementById("left-front"));
        await render(currentPage + 1, rf, document.getElementById("right-front"));
        await render(currentPage - 1, lb, document.getElementById("left-back"));
        await render(currentPage + 2, rb, document.getElementById("right-back"));
    }

    /* ---------- DRAG CORE ---------- */

    function pointerDown(x) {
        dragging = true;
        startX = x;
        rotation = 0;

        activeSheet = (x > 400) ? rightSheet : leftSheet;
        activeSheet.classList.add("dragging");
    }

    function pointerMove(x) {
        if (!dragging) return;

        const diff = x - startX;
        const width = 400;
        let progress = diff / width;
        progress = Math.max(-1, Math.min(1, progress));

        rotation = progress * 180;

/* shadow intensity follows curl */
const intensity = Math.min(Math.abs(rotation) / 180, 1);
activeSheet.style.setProperty("--shadow", intensity);


        if (activeSheet === rightSheet) {
            activeSheet.style.transform = `rotateY(${rotation}deg)`;
        } else {
            activeSheet.style.transform = `rotateY(${rotation}deg)`;
        }
    }

    async function pointerUp() {
        if (!dragging) return;
        dragging = false;

        activeSheet.classList.remove("dragging");
        activeSheet.style.transition = "transform 0.5s ease";

        /* NEXT PAGE (right sheet) */
        if (activeSheet === rightSheet && rotation < -90 && currentPage + 1 < totalPages) {
            activeSheet.style.transform = "rotateY(-180deg)";
            setTimeout(async () => {
                currentPage += 2;
                resetSheets();
                await loadPages();
            }, 300);
        }
        /* PREVIOUS PAGE (left sheet) */
        else if (activeSheet === leftSheet && rotation > 90 && currentPage > 1) {
            activeSheet.style.transform = "rotateY(180deg)";
            setTimeout(async () => {
                currentPage -= 2;
                resetSheets();
                await loadPages();
            }, 300);
        }
        /* CANCEL */
        else {
            activeSheet.style.transform = "rotateY(0deg)";
        }
    }

    function resetSheets() {
        leftSheet.style.transition = "none";
        rightSheet.style.transition = "none";
        leftSheet.style.transform = "rotateY(0deg)";
        rightSheet.style.transform = "rotateY(0deg)";
        leftSheet.style.removeProperty("--shadow");
        rightSheet.style.removeProperty("--shadow");

    }

    /* ---------- EVENTS ---------- */

    book.addEventListener("touchstart", e => pointerDown(e.touches[0].clientX));
    book.addEventListener("touchmove",  e => pointerMove(e.touches[0].clientX));
    book.addEventListener("touchend",   pointerUp);

    book.addEventListener("mousedown", e => pointerDown(e.clientX));
    window.addEventListener("mousemove", e => pointerMove(e.clientX));
    window.addEventListener("mouseup", pointerUp);

    /* ---------- INIT ---------- */

    pdfDoc = await pdfjsLib.getDocument(url).promise;
    totalPages = pdfDoc.numPages;
    await loadPages();
});
