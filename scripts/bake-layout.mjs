import { chromium } from "playwright";
import { writeFileSync } from "fs";
import path from "path";
import { pathToFileURL } from "url";

const WIDTH = parseInt(process.env.BAKE_WIDTH || "1920", 10);
const HEIGHT = parseInt(process.env.BAKE_HEIGHT || "945", 10);
const root = path.resolve(import.meta.dirname, "..");
const pageUrl = `${pathToFileURL(path.join(root, "index.html")).href}?bakeLayout=1`;
const outFile = path.join(root, "gallery-locked-layout.js");

const browser = await chromium.launch();
const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
});

await page.goto(pageUrl, { waitUntil: "load" });

await page.waitForFunction(
    () => {
        const inner = document.querySelector(".memory-gallery-inner");
        if (!inner) return false;
        const cards = [...inner.querySelectorAll(".memory-card")];
        if (cards.length < 55) return false;
        return cards.every((card) => {
            const left = parseFloat(card.style.left);
            const wrap = card.querySelector(".memory-card-photo-wrap");
            const photoH = parseFloat(wrap?.style.height);
            return Number.isFinite(left) && photoH > 0;
        });
    },
    { timeout: 180000 }
);

await page.evaluate(() => {
    if (typeof finalizeGalleryLayout === "function") {
        finalizeGalleryLayout();
    }
});

const snapshot = await page.evaluate(() => collectGalleryLayoutSnapshot());

if (!snapshot || snapshot.viewport.height !== HEIGHT) {
    console.warn(
        `Expected height ${HEIGHT}, got ${snapshot?.viewport?.height}. ` +
            "Layout may still be usable but verify in browser."
    );
}

const js = `const GALLERY_LOCKED_LAYOUT = ${JSON.stringify(snapshot)};\n`;
writeFileSync(outFile, js);

console.log(
    `Wrote ${outFile}\n` +
        `Viewport: ${snapshot.viewport.width}×${snapshot.viewport.height}\n` +
        `Cards: ${snapshot.cards.length}, bricks: ${snapshot.bricks.length}`
);

await browser.close();
