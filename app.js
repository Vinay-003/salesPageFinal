"use strict";
// ============================================================
// app.ts  --  ObesityKiller Sales Page  (plain TS, no frameworks)
// Compile:  npx tsc
// ============================================================
;
(function () {
    "use strict";
    // ── Helpers ──────────────────────────────────────────────
    const $ = (id) => document.getElementById(id);
    function clamp(n, min, max) {
        return Math.min(Math.max(n, min), max);
    }
    function pad2(n) {
        return n < 10 ? "0" + n : String(n);
    }
    function formatINR(amount) {
        return "\u20B9" + amount.toLocaleString("en-IN");
    }
    // ── Constants ────────────────────────────────────────────
    const GALLERY_IMAGES = [
        "https://theobesitykiller.com/cdn/shop/files/Hero_25_Nov_1_1024x.webp?v=1766510104",
        "https://theobesitykiller.com/cdn/shop/files/How_it_works_02351f73-b5eb-4c5e-876a-da648b7d8fbe_1024x.webp?v=1766510104",
        "https://theobesitykiller.com/cdn/shop/files/How_it_works_02351f73-b5eb-4c5e-876a-da648b7d8fbe_1024x.webp?v=1766510104",
        "https://theobesitykiller.com/cdn/shop/files/How_it_works_02351f73-b5eb-4c5e-876a-da648b7d8fbe_1024x.webp?v=1766510104",
        "https://theobesitykiller.com/cdn/shop/files/How_it_works_02351f73-b5eb-4c5e-876a-da648b7d8fbe_1024x.webp?v=1766510104",
    ];
    function thumbUrl(src) {
        return src.replace("_1024x", "_100x100");
    }
    const PLANS = {
        "15-day": { label: "15 Days", price: 3400, original: 6800, badge: "Essential", target: "3-5 kg" },
        "30-day": { label: "30 Days", price: 6800, original: 13600, badge: "Best Value", target: "6-10 kg" },
    };
    const TOTAL_STOCK = 500;
    const SALE_DURATION_S = 6 * 60 * 60; // 6 hours
    const STORAGE_KEY = "sale-countdown-end";
    const TICK_MS = 3000;
    const IS_MOBILE = window.matchMedia("(max-width: 639px)").matches;
    const DEFAULT_WINDOW_MIN = IS_MOBILE ? 1 : 2;
    const ZOOM_STEP_MIN = 10;
    const RECENT_WINDOW_MS = 5 * 60 * 1000;
    const SALES_30MIN_WINDOW_MS = 30 * 60 * 1000;
    // ── State ────────────────────────────────────────────────
    let currentImageIdx = 0;
    let selectedPlan = "15-day";
    let quantity = 1;
    let ordersRemaining = TOTAL_STOCK;
    let cumulativeSold = 0;
    let simulationActive = true;
    let lastScrollY = 0;
    const dropHistory = [];
    const chartData = [];
    let simulationStartMs = Date.now();
    // (chartDisplayMaxOrders removed — Y axis now snaps to visible data)
    let currentWindowMin = DEFAULT_WINDOW_MIN;
    let isAllMode = false;
    let lastTickMinute = 0;
    let latestChartPoints = [];
    let latestChartData = [];
    // ── DOM references ───────────────────────────────────────
    // (resolved after DOMContentLoaded)
    let galleryMain;
    let galleryStage;
    let galleryThumbs;
    let timerH;
    let timerM;
    let timerS;
    let sep1;
    let sep2;
    let stockCount;
    let stockBarFill;
    let stockWarning;
    let stockWarningText;
    let totalPrice;
    let totalOriginal;
    let buyBtnPrice;
    let qtyValue;
    let totalOrdered;
    let chartRemaining;
    let chartRecent;
    let chartSvg;
    let chartWrapper;
    let chartTooltip;
    let chartZoomInBtn;
    let chartZoomOutBtn;
    let chartWindowLabel;
    let sales30Min;
    let scrollTopBtn;
    let siteHeader;
    // ============================================================
    //  1. COUNTDOWN TIMER
    // ============================================================
    function initCountdown() {
        timerH = $("timer-h");
        timerM = $("timer-m");
        timerS = $("timer-s");
        sep1 = $("sep1");
        sep2 = $("sep2");
        let endTime;
        const stored = sessionStorage.getItem(STORAGE_KEY);
        if (stored) {
            endTime = parseInt(stored, 10);
        }
        else {
            endTime = Date.now() + SALE_DURATION_S * 1000;
            sessionStorage.setItem(STORAGE_KEY, String(endTime));
        }
        function tick() {
            const diff = Math.max(0, endTime - Date.now());
            const totalSec = Math.floor(diff / 1000);
            const h = Math.floor(totalSec / 3600);
            const m = Math.floor((totalSec % 3600) / 60);
            const s = totalSec % 60;
            timerH.textContent = pad2(h);
            timerM.textContent = pad2(m);
            timerS.textContent = pad2(s);
            // Urgent styling when < 1 hour
            const urgent = totalSec < 3600;
            const cls = urgent ? "urgent" : "normal";
            timerH.className = "time-box " + cls;
            timerM.className = "time-box " + cls;
            timerS.className = "time-box " + cls;
            sep1.className = "time-sep " + cls;
            sep2.className = "time-sep " + cls;
            // Bounce animation on seconds tick (after className set)
            timerS.classList.add("tick-bounce");
            setTimeout(() => timerS.classList.remove("tick-bounce"), 300);
        }
        tick();
        setInterval(tick, 1000);
    }
    // ============================================================
    //  2. GALLERY
    // ============================================================
    function initGallery() {
        galleryMain = document.getElementById("gallery-main");
        galleryStage = $("gallery-stage");
        galleryThumbs = $("gallery-thumbs");
        // Build thumbnails
        GALLERY_IMAGES.forEach((src, i) => {
            const btn = document.createElement("button");
            btn.className = "gallery-thumb" + (i === 0 ? " active" : "");
            btn.innerHTML = `<img src="${thumbUrl(src)}" alt="Thumbnail ${i + 1}" loading="lazy">`;
            btn.addEventListener("click", () => goToImage(i));
            galleryThumbs.appendChild(btn);
        });
        $("gallery-prev").addEventListener("click", () => goToImage((currentImageIdx - 1 + GALLERY_IMAGES.length) % GALLERY_IMAGES.length));
        $("gallery-next").addEventListener("click", () => goToImage((currentImageIdx + 1) % GALLERY_IMAGES.length));
        // --- Zoom / Pan state ---
        let zoomed = false;
        let zoomScale = 1;
        const MAX_ZOOM = 2.5;
        let panX = 0;
        let panY = 0;
        let dragStartX = 0;
        let dragStartY = 0;
        let dragging = false;
        let lastTap = 0;
        function applyTransform() {
            galleryMain.style.transform = `scale(${zoomScale}) translate(${panX}px, ${panY}px)`;
        }
        function resetZoom() {
            zoomed = false;
            zoomScale = 1;
            panX = 0;
            panY = 0;
            applyTransform();
        }
        // Tap to zoom / double-tap to reset
        galleryStage.addEventListener("click", (e) => {
            if (dragging)
                return;
            const now = Date.now();
            if (now - lastTap < 300) {
                // double-tap
                resetZoom();
                lastTap = 0;
                return;
            }
            lastTap = now;
            if (!zoomed) {
                zoomed = true;
                zoomScale = MAX_ZOOM;
                // Zoom towards tap point
                const rect = galleryStage.getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width - 0.5;
                const y = (e.clientY - rect.top) / rect.height - 0.5;
                panX = clamp(-x * 35, -35, 35);
                panY = clamp(-y * 35, -35, 35);
                applyTransform();
            }
            else {
                resetZoom();
            }
        });
        // Drag to pan while zoomed
        galleryStage.addEventListener("pointerdown", (e) => {
            if (!zoomed)
                return;
            dragging = true;
            dragStartX = e.clientX - panX;
            dragStartY = e.clientY - panY;
            galleryStage.setPointerCapture(e.pointerId);
        });
        galleryStage.addEventListener("pointermove", (e) => {
            if (!dragging)
                return;
            panX = clamp(e.clientX - dragStartX, -35, 35);
            panY = clamp(e.clientY - dragStartY, -35, 35);
            applyTransform();
        });
        galleryStage.addEventListener("pointerup", () => { dragging = false; });
        galleryStage.addEventListener("pointercancel", () => { dragging = false; });
        // Swipe navigation (touch only, when not zoomed)
        let swipeStartX = 0;
        galleryStage.addEventListener("touchstart", (e) => {
            if (zoomed)
                return;
            swipeStartX = e.touches[0].clientX;
        }, { passive: true });
        galleryStage.addEventListener("touchend", (e) => {
            if (zoomed)
                return;
            const dx = e.changedTouches[0].clientX - swipeStartX;
            if (Math.abs(dx) > 42) {
                goToImage(dx > 0
                    ? (currentImageIdx - 1 + GALLERY_IMAGES.length) % GALLERY_IMAGES.length
                    : (currentImageIdx + 1) % GALLERY_IMAGES.length);
            }
        });
    }
    function goToImage(idx) {
        currentImageIdx = idx;
        galleryMain.src = GALLERY_IMAGES[idx];
        // Update thumbnail active state
        const thumbs = galleryThumbs.querySelectorAll(".gallery-thumb");
        thumbs.forEach((t, i) => t.classList.toggle("active", i === idx));
    }
    // ============================================================
    //  3. ORDER SIMULATION  (time-driven sales curve)
    // ============================================================
    // Cumulative fraction of total stock that should be sold by time t.
    // Uses a hybrid curve that mimics real flash-sale behavior:
    //   - Early burst (0-15% of time): rapid FOMO-driven buying  (~45% of stock)
    //   - Mid phase  (15-60% of time): sustained but decelerating (~40% of stock)
    //   - Long tail  (60-100% of time): trickle of late buyers     (~15% of stock)
    //
    // f(t) = w1 * fastCurve(t) + w2 * midCurve(t) + w3 * tailCurve(t)
    // where t is in [0, 1] (fraction of sale duration elapsed)
    function cumulativeSalesFraction(t) {
        t = clamp(t, 0, 1);
        // Fast exponential curve — models the initial rush
        // Reaches ~0.95 by t=0.15, so most of its contribution happens early
        const fast = 1 - Math.exp(-20 * t);
        // Mid sigmoid — S-curve centered around t=0.35
        // Provides the sustained middle-phase demand
        const mid = 1 / (1 + Math.exp(-12 * (t - 0.35)));
        // Slow linear-ish tail — just t itself, gradual
        const tail = t;
        // Weighted blend: 45% fast burst, 40% mid sustained, 15% tail
        const blended = 0.45 * fast + 0.40 * mid + 0.15 * tail;
        // Clamp to [0, 1] — at t=1 the blend naturally ≈ 1.0
        return clamp(blended, 0, 1);
    }
    // The "expected" cumulative sold at this moment (deterministic baseline)
    function expectedSoldAt(elapsedS) {
        const t = clamp(elapsedS / SALE_DURATION_S, 0, 1);
        return Math.round(cumulativeSalesFraction(t) * TOTAL_STOCK);
    }
    function computeDrop() {
        if (ordersRemaining <= 0)
            return 0;
        const elapsedS = (Date.now() - simulationStartMs) / 1000;
        const expectedTotal = expectedSoldAt(elapsedS);
        // How many more should have sold by now vs how many actually sold
        let targetDrop = expectedTotal - cumulativeSold;
        // If we're ahead of the curve, occasionally still sell 0-1
        if (targetDrop <= 0) {
            return Math.random() < 0.1 ? 1 : 0;
        }
        // Add noise: ±30% randomness so each tick isn't perfectly smooth
        const noise = 0.7 + Math.random() * 0.6; // 0.7 – 1.3
        let drop = Math.round(targetDrop * noise);
        // Occasional demand spike: 5% chance, 1.5-2.5x multiplier
        // More likely early in the sale (first 30% of time)
        const t = elapsedS / SALE_DURATION_S;
        const spikeChance = t < 0.3 ? 0.08 : 0.03;
        if (Math.random() < spikeChance && drop > 0) {
            drop = Math.round(drop * (1.5 + Math.random()));
        }
        // Occasional zero-sale tick (~5%) to mimic natural pauses
        if (Math.random() < 0.05)
            return 0;
        // Ensure at least 1 sale if we're behind curve
        drop = Math.max(1, drop);
        // Never sell more than remaining
        drop = Math.min(drop, ordersRemaining);
        return drop;
    }
    function initSimulation() {
        simulationStartMs = Date.now();
        function tick() {
            if (!simulationActive)
                return;
            const now = Date.now();
            const drop = computeDrop();
            ordersRemaining = Math.max(0, ordersRemaining - drop);
            cumulativeSold += drop;
            if (drop > 0) {
                dropHistory.push({ timestamp: now, drop });
            }
            // Chart point
            const minuteOffset = (now - simulationStartMs) / 60000;
            lastTickMinute = minuteOffset;
            chartData.push({ minuteOffset, orders: drop, remaining: ordersRemaining });
            // Recent orders (last 5 min)
            const recentCutoff = now - RECENT_WINDOW_MS;
            const recentTotal = dropHistory
                .filter((d) => d.timestamp >= recentCutoff)
                .reduce((s, d) => s + d.drop, 0);
            updateSalesLast30Min(now);
            // Update DOM
            updateStockUI(recentTotal);
            renderChart();
            updateZoomButtonsState();
            if (ordersRemaining <= 0) {
                simulationActive = false;
            }
        }
        tick();
        setInterval(tick, TICK_MS);
    }
    function updateStockUI(recentOrders) {
        // Stock count
        stockCount.textContent = String(ordersRemaining);
        totalOrdered.textContent = String(cumulativeSold);
        chartRemaining.textContent = String(ordersRemaining);
        if (chartRecent) chartRecent.textContent = String(recentOrders);
        // Stock bar
        const pct = (ordersRemaining / TOTAL_STOCK) * 100;
        stockBarFill.style.width = pct + "%";
        // Color
        let barClass, textClass;
        if (pct > 20) {
            barClass = "bg-orange";
            textClass = "clr-orange";
        }
        else {
            barClass = "bg-red";
            textClass = "clr-red";
        }
        stockBarFill.className = "stock-bar-fill " + barClass;
        stockCount.className = "stock-count " + textClass;
        // Warning message
        if (pct <= 40 && pct > 10) {
            stockWarning.style.display = "flex";
            stockWarning.className = "stock-warning " + textClass;
            stockWarningText.textContent = "Selling fast! Only " + ordersRemaining + " kits left";
        }
        else if (pct <= 10) {
            stockWarning.style.display = "flex";
            stockWarning.className = "stock-warning " + textClass;
            stockWarningText.textContent = "Almost sold out! Only " + ordersRemaining + " kits left";
        }
        else {
            stockWarning.style.display = "none";
        }
    }
    function getVisibleData() {
        if (chartData.length === 0)
            return [];
        if (isAllMode)
            return chartData;
        const cutoffMinute = lastTickMinute - currentWindowMin;
        const visible = chartData.filter((d) => d.minuteOffset >= cutoffMinute);
        return visible.length >= 2 ? visible : chartData.slice(-2);
    }
    function getWindowLabel() {
        return isAllMode ? "All" : `${currentWindowMin}m`;
    }
    function updateZoomButtonsState() {
        chartZoomInBtn.disabled = currentWindowMin <= DEFAULT_WINDOW_MIN && !isAllMode;
        chartZoomOutBtn.disabled = isAllMode;
        chartWindowLabel.textContent = getWindowLabel();
    }
    function zoomInWindow() {
        if (isAllMode) {
            // Coming back from All: jump to the largest stepped window
            isAllMode = false;
            // Find the largest stepped window that makes sense
            const totalMin = lastTickMinute;
            currentWindowMin = Math.max(DEFAULT_WINDOW_MIN, Math.floor(totalMin / ZOOM_STEP_MIN) * ZOOM_STEP_MIN);
            if (currentWindowMin < ZOOM_STEP_MIN)
                currentWindowMin = DEFAULT_WINDOW_MIN;
        }
        else if (currentWindowMin > ZOOM_STEP_MIN) {
            currentWindowMin -= ZOOM_STEP_MIN;
        }
        else if (currentWindowMin === ZOOM_STEP_MIN) {
            currentWindowMin = DEFAULT_WINDOW_MIN;
        }
        else {
            return; // already at minimum
        }
        updateZoomButtonsState();
        renderChart();
    }
    function zoomOutWindow() {
        if (isAllMode)
            return;
        if (currentWindowMin < ZOOM_STEP_MIN) {
            // Jump from 2m to 10m
            currentWindowMin = ZOOM_STEP_MIN;
        }
        else {
            // Check if next step exceeds total data span; if so, go to All
            const nextWindow = currentWindowMin + ZOOM_STEP_MIN;
            if (nextWindow >= lastTickMinute && lastTickMinute > currentWindowMin) {
                isAllMode = true;
            }
            else if (nextWindow >= lastTickMinute) {
                isAllMode = true;
            }
            else {
                currentWindowMin = nextWindow;
            }
        }
        updateZoomButtonsState();
        renderChart();
    }
    function updateSalesLast30Min(now) {
        const cutoff = now - SALES_30MIN_WINDOW_MS;
        const total = dropHistory
            .filter((d) => d.timestamp >= cutoff)
            .reduce((s, d) => s + d.drop, 0);
        sales30Min.textContent = `${total} kits sold in last 30 min`;
    }
    // ============================================================
    //  4. SVG CHART  (smooth line + gradient area fill)
    // ============================================================
    function renderChart() {
        if (chartData.length < 2)
            return;
        const visibleData = getVisibleData();
        if (visibleData.length < 2)
            return;
        const svg = chartSvg;
        const isMobileChart = window.matchMedia("(max-width: 639px)").matches;
        const W = 800;
        const H = isMobileChart ? 420 : 280;
        const currentVBH = svg.viewBox.baseVal.height;
        if (currentVBH !== H) {
            svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
        }
        const PAD_LEFT = 52;
        const PAD_RIGHT = 15;
        const PAD_TOP = 20;
        const PAD_BOTTOM = 35;
        const plotW = W - PAD_LEFT - PAD_RIGHT;
        const plotH = H - PAD_TOP - PAD_BOTTOM;
        // Determine the window span in minutes
        // "nowMinute" is the latest tick's minuteOffset
        const nowMinute = lastTickMinute;
        let windowSpan;
        if (isAllMode) {
            windowSpan = Math.max(nowMinute, 0.1);
        }
        else {
            // Don't show a wider window than we have data for —
            // shrink to the actual data span so the line fills the chart width.
            const dataSpan = visibleData[visibleData.length - 1].minuteOffset - visibleData[0].minuteOffset;
            const effectiveSpan = Math.max(dataSpan, 0.1); // avoid zero-division
            windowSpan = Math.min(currentWindowMin, effectiveSpan * 1.05); // 5% breathing room
        }
        // Map data points to SVG x-coordinates.
        // The LATEST data point maps to the right edge, the OLDEST to the left edge.
        // This ensures the line always stretches across the full chart width.
        const dataMinMinute = visibleData[0].minuteOffset;
        const dataMaxMinute = visibleData[visibleData.length - 1].minuteOffset;
        const dataRange = Math.max(dataMaxMinute - dataMinMinute, 0.001);
        function xOf(minuteOffset) {
            const frac = (minuteOffset - dataMinMinute) / dataRange;
            return PAD_LEFT + frac * plotW;
        }
        // Use real data only — no synthetic points
        const plotData = visibleData;
        // Determine Y axis range — tight fit to visible data, small headroom only
        const rawMaxOrders = Math.max(...plotData.map((d) => d.orders), 1);
        const maxOrders = Math.max(Math.ceil(rawMaxOrders * 1.1), 1);
        function yOf(orders) {
            return PAD_TOP + plotH - (orders / maxOrders) * plotH;
        }
        // Only apply moving average smoothing when we have enough points
        const useSmoothing = plotData.length >= 6;
        const plotOrders = useSmoothing
            ? plotData.map((_, i) => {
                const prev = plotData[Math.max(0, i - 1)].orders;
                const curr = plotData[i].orders;
                const next = plotData[Math.min(plotData.length - 1, i + 1)].orders;
                return (prev + curr * 2 + next) / 4;
            })
            : plotData.map((d) => d.orders);
        const points = plotData.map((d, i) => ({ x: xOf(d.minuteOffset), y: yOf(plotOrders[i]) }));
        latestChartPoints = points;
        latestChartData = plotData;
        function catmullRomToBezier(pts) {
            if (pts.length < 2)
                return "";
            let path = `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
            if (pts.length === 2) {
                path += ` L${pts[1].x.toFixed(2)},${pts[1].y.toFixed(2)}`;
                return path;
            }
            // Use lower tension when data is sparse to prevent loops/overshooting
            const tension = pts.length < 6 ? 0.15 : 0.3;
            for (let i = 0; i < pts.length - 1; i++) {
                const p0 = pts[Math.max(i - 1, 0)];
                const p1 = pts[i];
                const p2 = pts[i + 1];
                const p3 = pts[Math.min(i + 2, pts.length - 1)];
                let cp1x = p1.x + (p2.x - p0.x) * tension;
                let cp1y = p1.y + (p2.y - p0.y) * tension;
                let cp2x = p2.x - (p3.x - p1.x) * tension;
                let cp2y = p2.y - (p3.y - p1.y) * tension;
                // Clamp control points so they can't go backwards on x-axis (prevents loops)
                cp1x = Math.min(cp1x, p2.x);
                cp1x = Math.max(cp1x, p1.x);
                cp2x = Math.max(cp2x, p1.x);
                cp2x = Math.min(cp2x, p2.x);
                path += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
            }
            return path;
        }
        const linePath = catmullRomToBezier(points);
        const baseline = PAD_TOP + plotH;
        const areaPath = linePath +
            ` L${points[points.length - 1].x.toFixed(2)},${baseline}` +
            ` L${points[0].x.toFixed(2)},${baseline} Z`;
        // Build X-axis labels (relative minutes from now)
        // Labels show "Xmin" where X is minutes ago, 0min at right edge
        let xLabels = "";
        const xTicks = []; // values in "minutes ago"
        // Determine visible span in "minutes ago" terms
        const oldestMinsAgo = nowMinute - dataMinMinute;
        const visibleSpanMin = Math.max(oldestMinsAgo, 0.1);
        if (visibleSpanMin <= 2.5) {
            // Short data: generate ticks at nice intervals within the actual data range
            // Always include 0 (now). Add ticks at 0.5min steps if data < 1m, 1min steps otherwise.
            const step = visibleSpanMin <= 1 ? 0.5 : 1;
            for (let t = 0; t <= oldestMinsAgo + 0.01; t += step) {
                xTicks.push(Math.round(t * 10) / 10);
            }
            // Ensure 0 is first
            if (xTicks[0] !== 0)
                xTicks.unshift(0);
        }
        else if (!isAllMode && currentWindowMin <= 2) {
            // Default 2m window: show exactly 2, 1, 0
            for (let i = currentWindowMin; i >= 0; i--) {
                xTicks.push(i);
            }
        }
        else if (!isAllMode) {
            // Stepped windows (10, 20, 30, ...): show ticks at 10-minute intervals
            for (let i = currentWindowMin; i >= 0; i -= ZOOM_STEP_MIN) {
                xTicks.push(i);
            }
            // Ensure 0 is included
            if (xTicks[xTicks.length - 1] !== 0)
                xTicks.push(0);
        }
        else {
            // All mode: determine a sensible step
            const totalSpan = Math.ceil(windowSpan);
            let step;
            if (totalSpan <= 10)
                step = 2;
            else if (totalSpan <= 30)
                step = 5;
            else if (totalSpan <= 60)
                step = 10;
            else
                step = 20;
            for (let i = Math.ceil(totalSpan / step) * step; i >= 0; i -= step) {
                xTicks.push(i);
            }
            if (xTicks[xTicks.length - 1] !== 0)
                xTicks.push(0);
        }
        for (const minsAgo of xTicks) {
            // minsAgo is "minutes ago", so the actual minuteOffset = nowMinute - minsAgo
            const actualMinuteOffset = nowMinute - minsAgo;
            const x = xOf(actualMinuteOffset);
            if (x >= PAD_LEFT - 1 && x <= W - PAD_RIGHT + 1) {
                const label = minsAgo === Math.floor(minsAgo) ? `${minsAgo}min` : `${minsAgo.toFixed(1)}m`;
                xLabels += `<text x="${x}" y="${H - 6}" text-anchor="middle" class="chart-axis-text">${label}</text>`;
                xLabels += `<line x1="${x}" y1="${PAD_TOP}" x2="${x}" y2="${baseline}" stroke="#e8e8e8" stroke-width="0.5"/>`;
            }
        }
        // Build Y-axis labels (3-4 ticks)
        let yLabels = "";
        const yStep = Math.ceil(maxOrders / 4);
        for (let v = 0; v <= maxOrders; v += yStep) {
            const y = yOf(v);
            yLabels += `<text x="${PAD_LEFT - 8}" y="${y + 4}" text-anchor="end" class="chart-axis-text">${v}</text>`;
            yLabels += `<line x1="${PAD_LEFT}" y1="${y}" x2="${W - PAD_RIGHT}" y2="${y}" stroke="#e8e8e8" stroke-width="0.5"/>`;
        }
        // No dots: keep the line clean
        svg.innerHTML = `
      <defs>
        <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(255,95,21,0.35)"/>
          <stop offset="100%" stop-color="rgba(255,95,21,0.02)"/>
        </linearGradient>
      </defs>
      ${xLabels}
      ${yLabels}
      <path d="${areaPath}" fill="url(#area-grad)"/>
      <path d="${linePath}" fill="none" stroke="rgb(255,95,21)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      
    `;
    }
    function initChartTooltip() {
        chartSvg.addEventListener("mousemove", (e) => {
            const svgRect = chartSvg.getBoundingClientRect();
            const rect = chartWrapper.getBoundingClientRect();
            const vbW = chartSvg.viewBox.baseVal.width || 800;
            const vbH = chartSvg.viewBox.baseVal.height || 300;
            const relX = (e.clientX - svgRect.left) / svgRect.width;
            const relY = (e.clientY - svgRect.top) / svgRect.height;
            if (relX < 0 || relX > 1 || relY < 0 || relY > 1)
                return;
            const xInSvg = relX * vbW;
            const yInSvg = relY * vbH;
            // Find nearest point by x distance
            const points = latestChartPoints;
            if (points.length === 0)
                return;
            let closestIdx = 0;
            let bestDist = Infinity;
            for (let i = 0; i < points.length; i++) {
                const dx = Math.abs(points[i].x - xInSvg);
                if (dx < bestDist) {
                    bestDist = dx;
                    closestIdx = i;
                }
            }
            const d = latestChartData[closestIdx];
            if (!d)
                return;
            const px = xInSvg * (svgRect.width / vbW) + svgRect.left - rect.left;
            const py = yInSvg * (svgRect.height / vbH) + svgRect.top - rect.top;
            chartTooltip.textContent = `${d.orders} orders at ${d.minuteOffset.toFixed(1)}m | ${d.remaining} left`;
            chartTooltip.style.left = px + "px";
            chartTooltip.style.top = py + "px";
            chartTooltip.classList.add("visible");
        });
        chartSvg.addEventListener("mouseleave", () => {
            chartTooltip.classList.remove("visible");
        });
    }
    function initChartControls() {
        chartZoomInBtn.addEventListener("click", zoomInWindow);
        chartZoomOutBtn.addEventListener("click", zoomOutWindow);
        updateZoomButtonsState();
    }
    // ============================================================
    //  5. PLAN SELECTION & QUANTITY
    // ============================================================
    function initPlans() {
        const plan15Btn = $("plan-15");
        const plan30Btn = $("plan-30");
        function selectPlan(planKey) {
            selectedPlan = planKey;
            plan15Btn.classList.toggle("active", planKey === "15-day");
            plan30Btn.classList.toggle("active", planKey === "30-day");
            updatePriceDisplay();
        }
        plan15Btn.addEventListener("click", () => selectPlan("15-day"));
        plan30Btn.addEventListener("click", () => selectPlan("30-day"));
        // Quantity
        const minusBtn = $("qty-minus");
        const plusBtn = $("qty-plus");
        qtyValue = $("qty-value");
        minusBtn.addEventListener("click", () => {
            quantity = Math.max(1, quantity - 1);
            qtyValue.textContent = String(quantity);
            updateQtyBtnState(minusBtn, plusBtn);
            updatePriceDisplay();
        });
        plusBtn.addEventListener("click", () => {
            quantity = Math.min(10, quantity + 1);
            qtyValue.textContent = String(quantity);
            updateQtyBtnState(minusBtn, plusBtn);
            updatePriceDisplay();
        });
        function updateQtyBtnState(minus, plus) {
            minus.disabled = quantity <= 1;
            plus.disabled = quantity >= 10;
        }
        // Set initial plan prices in buttons
        ;
        ["15-day", "30-day"].forEach((key) => {
            const p = PLANS[key];
            const priceEl = $(`plan-${key === "15-day" ? "15" : "30"}-price`);
            const origEl = $(`plan-${key === "15-day" ? "15" : "30"}-original`);
            priceEl.textContent = formatINR(p.price);
            origEl.textContent = formatINR(p.original);
        });
        updatePriceDisplay();
    }
    function updatePriceDisplay() {
        const plan = PLANS[selectedPlan];
        const total = plan.price * quantity;
        const originalTotal = plan.original * quantity;
        totalPrice.textContent = formatINR(total);
        totalOriginal.textContent = formatINR(originalTotal);
        buyBtnPrice.textContent = formatINR(total);
    }
    // ============================================================
    //  6. COUPON COPY
    // ============================================================
    function initCoupon() {
        const btn = $("coupon-btn");
        const copyIcon = $("copy-icon");
        const checkIcon = $("check-icon");
        const copyWrap = $("coupon-copy-icon");
        btn.addEventListener("click", () => {
            navigator.clipboard.writeText("OKKFIT50").then(() => {
                copyIcon.style.display = "none";
                checkIcon.style.display = "block";
                copyWrap.classList.add("copied");
                setTimeout(() => {
                    copyIcon.style.display = "block";
                    checkIcon.style.display = "none";
                    copyWrap.classList.remove("copied");
                }, 2000);
            });
        });
    }
    // ============================================================
    //  8. SCROLL-TO-TOP
    // ============================================================
    function initScrollTop() {
        scrollTopBtn = $("scroll-top");
        scrollTopBtn.addEventListener("click", () => {
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
        window.addEventListener("scroll", () => {
            scrollTopBtn.classList.toggle("visible", window.scrollY > 400);
        }, { passive: true });
    }
    // ============================================================
    //  9. HEADER HIDE-ON-SCROLL-DOWN
    // ============================================================
    function initHeaderScroll() {
        siteHeader = $("site-header");
        lastScrollY = window.scrollY;
        window.addEventListener("scroll", () => {
            const current = window.scrollY;
            if (current > lastScrollY && current > 80) {
                siteHeader.classList.add("hidden-up");
            }
            else {
                siteHeader.classList.remove("hidden-up");
            }
            lastScrollY = current;
        }, { passive: true });
    }
    // ============================================================
    //  10. STARS
    // ============================================================
    function initStars() {
        const starsEl = $("stars");
        const starSvg = `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="0"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
        starsEl.innerHTML = starSvg.repeat(5);
    }
    // ============================================================
    //  INIT
    // ============================================================
    document.addEventListener("DOMContentLoaded", () => {
        // Resolve DOM references
        stockCount = $("stock-count");
        stockBarFill = $("stock-bar-fill");
        stockWarning = $("stock-warning");
        stockWarningText = $("stock-warning-text");
        totalPrice = $("total-price");
        totalOriginal = $("total-original");
        buyBtnPrice = $("buy-btn-price");
        totalOrdered = $("total-ordered");
        chartRemaining = $("chart-remaining");
        chartRecent = $("chart-recent");
        chartSvg = document.getElementById("chart-svg");
        chartWrapper = $("chart-wrapper");
        chartTooltip = $("chart-tooltip");
        chartZoomInBtn = $("chart-zoom-in");
        chartZoomOutBtn = $("chart-zoom-out");
        chartWindowLabel = $("chart-window-label");
        sales30Min = $("sales-30min");
        initStars();
        initCountdown();
        initGallery();
        initPlans();
        initCoupon();
        initChartControls();
        updateSalesLast30Min(Date.now());
        initSimulation();
        initChartTooltip();
        initScrollTop();
        initHeaderScroll();
    });
})();
