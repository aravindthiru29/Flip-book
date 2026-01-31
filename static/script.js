document.addEventListener("DOMContentLoaded", () => {
    const leftCanvas = document.getElementById("left-canvas");
    const rightCanvas = document.getElementById("right-canvas");
    const leftCtx = leftCanvas.getContext("2d");
    const rightCtx = rightCanvas.getContext("2d");

    const prevBtn = document.getElementById("prev");
    const nextBtn = document.getElementById("next");
    const pageInfo = document.getElementById("page-info");

    const url = `/uploads/${PDF_FILE}`;

    let pdfDoc = null;
    let totalPages = 0;
    let currentPage = 1; 
    let isRendering = false;
    const scale = 1.1;
    const book = document.querySelector(".book");

function flipBook() {
    book.classList.toggle("flip");
}

    async function renderPage(pageNum, canvas, ctx) {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale });

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
            canvasContext: ctx,
            viewport: viewport
        }).promise;
    }

    async function renderView() {
        if (isRendering) return;
        isRendering = true;

        leftCanvas.classList.add("flip-out");
        rightCanvas.classList.add("flip-out");

        setTimeout(async () => {
            leftCtx.clearRect(0, 0, leftCanvas.width, leftCanvas.height);
            rightCtx.clearRect(0, 0, rightCanvas.width, rightCanvas.height);

            if (currentPage === 1) {
                await renderPage(1, leftCanvas, leftCtx);
                rightCanvas.style.visibility = "hidden";
                pageInfo.textContent = `Cover (Page 1 of ${totalPages})`;
                prevBtn.disabled = true;
            } else {
                rightCanvas.style.visibility = "visible";

                await renderPage(currentPage, leftCanvas, leftCtx);

                if (currentPage + 1 <= totalPages) {
                    await renderPage(currentPage + 1, rightCanvas, rightCtx);
                }

                pageInfo.textContent = `Pages ${currentPage}–${Math.min(currentPage + 1, totalPages)} of ${totalPages}`;
                prevBtn.disabled = false;
            }

            nextBtn.disabled = currentPage >= totalPages;

            leftCanvas.classList.remove("flip-out");
            rightCanvas.classList.remove("flip-out");
            leftCanvas.classList.add("flip-in");
            rightCanvas.classList.add("flip-in");

            isRendering = false;
        }, 200);
    }

    pdfjsLib.getDocument(url).promise.then(pdf => {
        pdfDoc = pdf;
        totalPages = pdf.numPages;
        renderView();
    });

    nextBtn.onclick = () => {
        if (currentPage === 1) {
            currentPage = 2;
        } else if (currentPage + 2 <= totalPages) {
            currentPage += 2;
        }
        renderView();
    };

    prevBtn.onclick = () => {
        if (currentPage === 2) {
            currentPage = 1;
        } else if (currentPage > 2) {
            currentPage -= 2;
        }
        renderView();
    };
});
