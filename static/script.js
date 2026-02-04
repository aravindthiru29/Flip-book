document.addEventListener("DOMContentLoaded", async () => {

    const book = document.querySelector(".book");
    const leftSheet  = document.querySelector(".left-sheet");
    const rightSheet = document.querySelector(".right-sheet");

    const lf = document.getElementById("left-front").getContext("2d");
    const lb = document.getElementById("left-back").getContext("2d");
    const rf = document.getElementById("right-front").getContext("2d");
    const rb = document.getElementById("right-back").getContext("2d");

    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");
    const pageIndicator = document.getElementById("pageIndicator");


    const url = `/uploads/${PDF_FILE}`;
    const scale = 1.2;

    let pdfDoc, totalPages;
    let currentPage = 1;

    let activeSheet = null;
    let startX = 0;
    let lastX = 0;
    let lastTime = 0;
    let velocity = 0;
    let rotation = 0;
    let dragging = false;

// ---------------- RESPONSIVE  FOR MOBILE----------------
    let isMobile = window.innerWidth <= 768;

window.addEventListener("resize", () => {
    const nowMobile = window.innerWidth <= 768;
    if (nowMobile !== isMobile) {
        isMobile = nowMobile;
        resetForMode();
    }
});

    /* ---------------- PDF ---------------- */

    async function render(n, ctx, canvas) {
        if (n < 1 || n > totalPages) {
            ctx.clearRect(0,0,9999,9999);
            return;
        }
        const page = await pdfDoc.getPage(n);
        const vp = page.getViewport({ scale });
        canvas.width = vp.width;
        canvas.height = vp.height;
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
    }

    async function loadPages() {

    if (isMobile) {
        // SINGLE PAGE MODE
        lf.clearRect(0,0,9999,9999);
        lb.clearRect(0,0,9999,9999);
        rb.clearRect(0,0,9999,9999);

        await render(currentPage, rf, rightSheet.querySelector("#right-front"));
    }

    else if (currentPage === 1) {
        // COVER
        lf.clearRect(0,0,9999,9999);
        lb.clearRect(0,0,9999,9999);
        await render(1, rf, rightSheet.querySelector("#right-front"));
        rb.clearRect(0,0,9999,9999);
    }

    else {
        // NORMAL SPREAD
        await render(currentPage, lf, leftSheet.querySelector("#left-front"));
        await render(currentPage + 1, rf, rightSheet.querySelector("#right-front"));
        await render(currentPage - 1, lb, leftSheet.querySelector("#left-back"));
        await render(currentPage + 2, rb, rightSheet.querySelector("#right-back"));
    }

    book.style.setProperty(
        "--stack",
        isMobile ? 0 : Math.floor((currentPage - 1) / 2)
    );

    updateIndicator();
}


    /* ---------------- DRAG ---------------- */

    function pointerDown(x) {
        dragging = true;
        startX = lastX = x;
        lastTime = performance.now();
        velocity = 0;

        activeSheet = x > book.offsetWidth / 2 ? rightSheet : leftSheet;
        activeSheet.classList.add("active");
        activeSheet.classList.remove("settle");
    }

    function pointerMove(x) {
        if (!dragging) return;

        const now = performance.now();
        velocity = (x - lastX) / (now - lastTime);
        lastX = x;
        lastTime = now;

        const diff = x - startX;
        const progress = Math.max(-1, Math.min(1, diff / 400));

        if (activeSheet === rightSheet) {
            rotation = Math.min(0, progress * 180);
        } else {
            rotation = Math.max(0, progress * 180);
        }

        activeSheet.style.transform = `rotateY(${rotation}deg)`;
        activeSheet.style.setProperty("--shadow", Math.abs(rotation) / 180);
    }

   async function pointerUp() {
    if (!dragging) return;
    dragging = false;

    /* ================= MOBILE SWIPE ================= */
    if (isMobile) {

        // swipe LEFT → next page
        if (rotation < -60 && currentPage < totalPages) {
            currentPage++;
        }
        // swipe RIGHT → previous page
        else if (rotation > 60 && currentPage > 1) {
            currentPage--;
        }

        cleanup();
        await loadPages();
        return; 
    }

    /* ================= DESKTOP FLIP ================= */

    activeSheet.classList.add("settle");

    // NEXT PAGE
    if (activeSheet === rightSheet && rotation < -90 && currentPage < totalPages) {
        activeSheet.style.transform = "rotateY(-180deg)";

        setTimeout(async () => {
            currentPage = currentPage === 1 ? 2 : currentPage + 2;
            cleanup();
            await loadPages();
        }, 450);
    }

    // PREVIOUS PAGE
    else if (activeSheet === leftSheet && rotation > 90 && currentPage > 1) {
        activeSheet.style.transform = "rotateY(-180deg)";

        setTimeout(async () => {
            currentPage = currentPage === 2 ? 1 : currentPage - 2;
            cleanup();
            await loadPages();
        }, 450);
    }

    // CANCEL
    else {
        activeSheet.style.transform = "rotateY(0deg)";
        activeSheet.style.setProperty("--shadow", 0);
        cleanup();
    }
}


    function updateIndicator() {
    if (isMobile) {
        pageIndicator.textContent = `Page ${currentPage}`;
    } else {
        pageIndicator.textContent =
            currentPage === 1
                ? "Page 1"
                : `Pages ${currentPage}–${Math.min(currentPage + 1, totalPages)}`;
    }

    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;
}

    function cleanup() {
    leftSheet.classList.remove("active", "settle");
    rightSheet.classList.remove("active", "settle");

    leftSheet.style.transform = "rotateY(0deg)";
    rightSheet.style.transform = "rotateY(0deg)";

    leftSheet.style.setProperty("--shadow", 0);
    rightSheet.style.setProperty("--shadow", 0);

    activeSheet = null;
}

 /* ---------------- NEXT BUTTONS ---------------- */
   nextBtn.onclick = async () => {
    if (currentPage >= totalPages) return;

    activeSheet = rightSheet;

    /*  HARD RESET */
    activeSheet.classList.remove("settle");
    activeSheet.style.transitionDuration = "0s";
    activeSheet.style.transform = "rotateY(180deg)";
    activeSheet.offsetHeight;

    /* FAST BUTTON FLIP */
    activeSheet.classList.add("active", "settle");
    activeSheet.style.transitionDuration = "0.22s";
    activeSheet.style.setProperty("--shadow", 1);
    activeSheet.style.transform = "rotateY(-180deg)";

    setTimeout(async () => {
        currentPage = currentPage === 1 ? 2 : currentPage + 2;
        cleanup();
        await loadPages();
    }, 220);
};

//  ---------------- PREV BUTTONS ---------------- */
prevBtn.onclick = async () => {
    if (currentPage <= 1) return;

    activeSheet = leftSheet;

    /* HARD RESET (prevents 360°) */
    activeSheet.classList.remove("settle");
    activeSheet.style.transitionDuration = "0s";
    activeSheet.style.transform = "rotateY(-180deg)";
    activeSheet.offsetHeight; // force reflow

    /* FAST BUTTON FLIP */
    activeSheet.classList.add("active", "settle");
    activeSheet.style.transitionDuration = "0.22s";
    activeSheet.style.setProperty("--shadow", 1);
    activeSheet.style.transform = "rotateY(180deg)";

    setTimeout(async () => {
        currentPage = currentPage === 2 ? 1 : currentPage - 2;
        cleanup();
        await loadPages();
    }, 220);
};


// ---------------- RESET FOR MODE CHANGE ---------------- */
async function resetForMode() {
    cleanup();

    if (isMobile) {
        // mobile uses real page number
        currentPage = Math.max(1, currentPage);
    } else {
        // desktop snaps to left-page logic
        if (currentPage % 2 === 0) currentPage -= 1;
    }

    await loadPages();
}

    /* ---------------- EVENTS ---------------- */

    book.addEventListener("mousedown", e => pointerDown(e.clientX));
    window.addEventListener("mousemove", e => pointerMove(e.clientX));
    window.addEventListener("mouseup", pointerUp);

    book.addEventListener("touchstart", e => pointerDown(e.touches[0].clientX));
    book.addEventListener("touchmove", e => pointerMove(e.touches[0].clientX));
    book.addEventListener("touchend", pointerUp);

    /* ---------------- INIT ---------------- */

    pdfDoc = await pdfjsLib.getDocument(url).promise;
    totalPages = pdfDoc.numPages;
    await loadPages();
    updatePageIndicator();
});