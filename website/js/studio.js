const form = document.getElementById("studio-form");
const statusEl = document.getElementById("studioStatus");
const resultsSection = document.getElementById("resultsSection");
const docPreview = document.getElementById("docPreview");
const resultTitle = document.getElementById("resultTitle");
const resultMeta = document.getElementById("resultMeta");
const coverCanvas = document.getElementById("coverCanvas");
const ctx = coverCanvas.getContext("2d");

let latestDoc = "";
let latestTitle = "White Lab Studio Export";
let latestUrl = "";

function setStatus(message, tone = "info") {
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "documentation";
}

function wrapText(context, text, x, y, maxWidth, lineHeight, maxLines = 4) {
  const words = text.split(/\s+/);
  let line = "";
  let lineCount = 0;
  let cursorY = y;

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (context.measureText(test).width > maxWidth && line) {
      context.fillText(line, x, cursorY);
      line = word;
      cursorY += lineHeight;
      lineCount += 1;
      if (lineCount >= maxLines) return cursorY;
    } else {
      line = test;
    }
  }
  if (line && lineCount < maxLines) {
    context.fillText(line, x, cursorY);
    cursorY += lineHeight;
  }
  return cursorY;
}

function drawCoverText({ title, url, summary }) {
  const width = coverCanvas.width;
  const height = coverCanvas.height;

  ctx.fillStyle = "#ffffff";
  ctx.font = "600 28px Inter, ui-sans-serif, system-ui, sans-serif";
  ctx.fillText("WHITE LAB STUDIO", 72, 96);

  ctx.font = "700 56px Inter, ui-sans-serif, system-ui, sans-serif";
  const titleY = wrapText(ctx, title, 72, 170, width - 144, 62, 2);

  ctx.fillStyle = "#b8b8b8";
  ctx.font = "400 24px Inter, ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(url, 72, titleY + 24);

  ctx.fillStyle = "#d8d8d8";
  ctx.font = "400 22px Inter, ui-sans-serif, system-ui, sans-serif";
  wrapText(ctx, summary || "Documentation export", 72, titleY + 72, width - 144, 30, 3);

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(72, height - 120, 260, 52, 26);
  ctx.fill();
  ctx.fillStyle = "#000000";
  ctx.font = "700 20px Inter, ui-sans-serif, system-ui, sans-serif";
  ctx.fillText("Client-ready doc", 92, height - 87);
}

function drawCoverImage({ title, url, summary, screenshotUrl }) {
  const width = coverCanvas.width;
  const height = coverCanvas.height;

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, width, height);

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "rgba(255,255,255,0.16)");
  gradient.addColorStop(1, "rgba(138,180,255,0.08)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, width - 48, height - 48);

  const renderText = () => drawCoverText({ title, url, summary });

  if (screenshotUrl) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ctx.globalAlpha = 0.22;
      ctx.drawImage(img, width - 420, 80, 360, 220);
      ctx.globalAlpha = 1;
      renderText();
    };
    img.onerror = renderText;
    img.src = screenshotUrl;
    return;
  }

  renderText();
}

async function runScrape(event) {
  event.preventDefault();

  const url = document.getElementById("targetUrl").value.trim();
  const template = document.getElementById("templateSelect").value;
  const runButton = document.getElementById("runScrape");

  runButton.disabled = true;
  setStatus("Scraping and formatting documentation…");

  try {
    const response = await fetch("/api/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, template }),
    });

    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "Scrape request failed.");
    }

    latestDoc = payload.documentation;
    latestTitle = payload.title || "Documentation export";
    latestUrl = payload.url;

    resultTitle.textContent = latestTitle;
    resultMeta.textContent = `${payload.provider} · ${new Date(payload.generatedAt).toLocaleString()} · ${payload.url}`;
    docPreview.textContent = latestDoc;
    resultsSection.hidden = false;
    resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });

    if (document.getElementById("generateCover").checked) {
      drawCoverImage({
        title: latestTitle,
        url: latestUrl,
        summary: payload.summary,
        screenshotUrl: payload.screenshot,
      });
    }

    setStatus("Done. Export markdown or cover image below.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    runButton.disabled = false;
  }
}

function downloadBlob(filename, blob) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

document.getElementById("copyDoc").addEventListener("click", async () => {
  if (!latestDoc) return;
  await navigator.clipboard.writeText(latestDoc);
  setStatus("Markdown copied to clipboard.", "success");
});

document.getElementById("downloadDoc").addEventListener("click", () => {
  if (!latestDoc) return;
  downloadBlob(`${slugify(latestTitle)}.md`, new Blob([latestDoc], { type: "text/markdown;charset=utf-8" }));
});

document.getElementById("downloadCover").addEventListener("click", () => {
  coverCanvas.toBlob((blob) => {
    if (!blob) return;
    downloadBlob(`${slugify(latestTitle)}-cover.png`, blob);
  }, "image/png");
});

document.getElementById("resetStudio").addEventListener("click", () => {
  form.reset();
  latestDoc = "";
  resultsSection.hidden = true;
  setStatus("Ready.");
});

form.addEventListener("submit", runScrape);
