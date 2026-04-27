(function () {
    "use strict";

    const DESKTOP_MEDIA_QUERY = "(hover: hover) and (pointer: fine)";
    const MIN_VIEWPORT_WIDTH = 1100;
    const MIN_SIDEBAR_WIDTH = 92;
    const MAX_DPR = 2;
    const ORIGINAL_WORLD_HEIGHT = 10.5;
    const ORIGINAL_RISE_SPEED_BASE = 0.025;
    const ORIGINAL_RISE_SPEED_RANGE = 0.02;
    const ORIGINAL_SPLASH_RADIUS = 4.5;
    const ORIGINAL_SPLASH_STRENGTH = 0.18;
    const ORIGINAL_SPLASH_DECAY = 0.92;
    const ORIGINAL_SPLASH_RADIUS_SCALE = 0.6;
    const CURRENT_SPLASH_RADIUS_SCALE = 0.7;
    const DENSITY_MULTIPLIER = 6;
    const SIDEBAR_BACKGROUND_FL = 3;
    const SIDEBAR_BACKGROUND_FLAG = SIDEBAR_BACKGROUND_FL;
    const MAX_TRAIL_POINTS = 26;
    const MAX_SPARKLES = 96;
    const SPARKLES_PER_MOVE = 2;
    const GLOBAL_CONTROLLER_KEY = "__sideCodeRainController";
    const SECRET_TRIGGER_SELECTOR = ".side-rain-secret-trigger";
    const SWITCHING_CLASS = "is-switching";
    const SWITCHING_CLASS_DURATION_MS = 220;
    const RANDOM_POOL_SIZE = 10000;

    const CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz{}[]()<>/\\|?*&^%$#@!+-=~`;:.,_¥￥€£¢§¶^°±×÷≠≈≤≥√∑∏∆∞∫∂µπ";
    const COLOR_PALETTE = [
        "#4dd9ff",
        "#66ffb3",
        "#ffd166",
        "#ff8a5b",
        "#ff5fa3",
        "#9c7dff",
        "#7ef2ff",
        "#6fa8ff"
    ];

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    let randomPool = null;
    let randomPoolIndex = 0;

    function ensureRandomPool() {
        if (randomPool) {
            return;
        }
        randomPool = new Float32Array(RANDOM_POOL_SIZE);
        for (let i = 0; i < RANDOM_POOL_SIZE; i++) {
            randomPool[i] = Math.random();
        }
    }

    function nextRandom() {
        ensureRandomPool();
        const value = randomPool[randomPoolIndex];
        randomPoolIndex = (randomPoolIndex + 1) % RANDOM_POOL_SIZE;
        return value;
    }

    function nextRandomRange(min, max) {
        return min + nextRandom() * (max - min);
    }

    function nextRandomInt(maxExclusive) {
        return Math.floor(nextRandom() * maxExclusive);
    }

    function isDesktopEligible() {
        return window.matchMedia(DESKTOP_MEDIA_QUERY).matches && window.innerWidth >= MIN_VIEWPORT_WIDTH;
    }

    function normalizeBackgroundFlag(value) {
        const parsed = Number(value);
        return parsed >= 1 && parsed <= 4 ? parsed : SIDEBAR_BACKGROUND_FLAG;
    }

    let currentBackgroundFlag = normalizeBackgroundFlag(SIDEBAR_BACKGROUND_FLAG);

    function getSidebarBackgroundFlag() {
        return currentBackgroundFlag;
    }

    class SidebarCodeRain {
        constructor(root) {
            this.root = root;
            this.rainCanvas = root.querySelector(".code-rain-canvas");
            this.trailCanvas = root.querySelector(".code-rain-trail");
            this.rainCtx = this.rainCanvas.getContext("2d");
            this.trailCtx = this.trailCanvas.getContext("2d");

            this.width = 0;
            this.height = 0;
            this.dpr = 1;
            this.enabled = false;
            this.particles = [];
            this.trailPoints = [];
            this.sparkles = [];
            this.pointer = null;
            this.isHovering = false;
            this.lastTimestamp = 0;
            this.lastTrailX = null;
            this.lastTrailY = null;
            this.hoverHue = nextRandom() * 360;
            this.worldScale = 1;
            this.splashActive = false;
            this.handleClickBound = (event) => this.handleClick(event);
            this.handleMouseEnterBound = (event) => {
                this.isHovering = true;
                this.hoverHue = nextRandom() * 360;
                this.seedTrail(event);
            };
            this.handleMouseMoveBound = (event) => this.handleMouseMove(event);
            this.handleMouseLeaveBound = () => {
                this.isHovering = false;
                this.pointer = null;
                this.lastTrailX = null;
                this.lastTrailY = null;
            };

            this.attachEvents();
        }

        attachEvents() {
            this.root.addEventListener("click", this.handleClickBound);
            this.root.addEventListener("mouseenter", this.handleMouseEnterBound);
            this.root.addEventListener("mousemove", this.handleMouseMoveBound);
            this.root.addEventListener("mouseleave", this.handleMouseLeaveBound);
        }

        detachEvents() {
            this.root.removeEventListener("click", this.handleClickBound);
            this.root.removeEventListener("mouseenter", this.handleMouseEnterBound);
            this.root.removeEventListener("mousemove", this.handleMouseMoveBound);
            this.root.removeEventListener("mouseleave", this.handleMouseLeaveBound);
        }

        setEnabled(enabled) {
            this.enabled = enabled;
            this.root.style.display = enabled ? "block" : "none";
            if (!enabled) {
                this.pointer = null;
                this.trailPoints.length = 0;
                this.sparkles.length = 0;
                this.splashActive = false;
                this.clearCanvases();
            }
        }

        resize() {
            if (!this.enabled) {
                return;
            }

            const rect = this.root.getBoundingClientRect();
            this.width = Math.max(0, Math.floor(rect.width));
            this.height = Math.max(0, Math.floor(rect.height));
            this.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
            this.worldScale = this.height / ORIGINAL_WORLD_HEIGHT;

            const canvases = [this.rainCanvas, this.trailCanvas];
            for (const canvas of canvases) {
                canvas.width = Math.max(1, Math.floor(this.width * this.dpr));
                canvas.height = Math.max(1, Math.floor(this.height * this.dpr));
                canvas.style.width = this.width + "px";
                canvas.style.height = this.height + "px";
            }

            this.rainCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
            this.trailCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
            this.rebuildParticles();
        }

        clearCanvases() {
            this.rainCtx.clearRect(0, 0, this.width, this.height);
            this.trailCtx.clearRect(0, 0, this.width, this.height);
        }

        rebuildParticles() {
            if (!this.width || !this.height) {
                this.particles.length = 0;
                return;
            }

            const baseCount = Math.floor((this.width * this.height) / 5600);
            const targetCount = clamp(baseCount * DENSITY_MULTIPLIER, 72, 396);
            this.particles.length = 0;
            for (let i = 0; i < targetCount; i++) {
                this.particles.push(this.createParticle(false));
            }
        }

        randomChar() {
            return CHARSET.charAt(nextRandomInt(CHARSET.length));
        }

        randomColor() {
            const base = COLOR_PALETTE[nextRandomInt(COLOR_PALETTE.length)];
            if (nextRandom() > 0.22) {
                return base;
            }
            const hue = Math.floor(nextRandom() * 360);
            return "hsl(" + hue + ", 88%, 68%)";
        }

        createParticle(fromBottom) {
            const size = nextRandomRange(13, 26);
            return {
                x: nextRandom() * this.width,
                y: fromBottom ? this.height + nextRandom() * 36 : nextRandom() * this.height,
                vx: 0,
                vy: 0,
                speed: (ORIGINAL_RISE_SPEED_BASE + nextRandom() * ORIGINAL_RISE_SPEED_RANGE) * this.worldScale,
                drift: (nextRandom() - 0.5) * 0.8,
                phase: nextRandom() * Math.PI * 2,
                alpha: nextRandomRange(0.52, 0.92),
                size: size,
                char: this.randomChar(),
                color: this.randomColor()
            };
        }

        resetParticle(particle, fromBottom) {
            const fresh = this.createParticle(fromBottom);
            particle.x = fresh.x;
            particle.y = fresh.y;
            particle.vx = fresh.vx;
            particle.vy = fresh.vy;
            particle.speed = fresh.speed;
            particle.drift = fresh.drift;
            particle.phase = fresh.phase;
            particle.alpha = fresh.alpha;
            particle.size = fresh.size;
            particle.char = fresh.char;
            particle.color = fresh.color;
        }

        seedTrail(event) {
            const rect = this.root.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            this.pointer = { x: x, y: y };
            this.pushTrailPoint(x, y, true);
        }

        handleMouseMove(event) {
            if (!this.enabled) {
                return;
            }
            const rect = this.root.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            this.pointer = { x: x, y: y };
            this.pushTrailPoint(x, y, false);
        }

        pushTrailPoint(x, y, force) {
            if (!force && this.lastTrailX !== null && this.lastTrailY !== null) {
                const dx = x - this.lastTrailX;
                const dy = y - this.lastTrailY;
                if ((dx * dx + dy * dy) < 9) {
                    return;
                }
            }

            this.lastTrailX = x;
            this.lastTrailY = y;

            this.trailPoints.push({
                x: x,
                y: y,
                life: 1.0,
                color: "hsl(" + this.hoverHue + ", 95%, 70%)"
            });
            if (this.trailPoints.length > MAX_TRAIL_POINTS) {
                this.trailPoints.splice(0, this.trailPoints.length - MAX_TRAIL_POINTS);
            }

            for (let i = 0; i < SPARKLES_PER_MOVE; i++) {
                if (this.sparkles.length >= MAX_SPARKLES) {
                    this.sparkles.shift();
                }
                this.sparkles.push({
                    x: x + (nextRandom() - 0.5) * 5,
                    y: y + (nextRandom() - 0.5) * 5,
                    vx: (nextRandom() - 0.5) * 1.8,
                    vy: (nextRandom() - 0.5) * 1.8,
                    radius: nextRandomRange(0.8, 2.6),
                    life: nextRandomRange(0.8, 1.3),
                    color: "hsla(" + ((this.hoverHue + nextRandom() * 40 - 20 + 360) % 360) + ", 100%, 75%, 1)"
                });
            }
        }

        handleClick(event) {
            if (!this.enabled || !this.width || !this.height) {
                return;
            }

            const rect = this.root.getBoundingClientRect();
            const centerX = event.clientX - rect.left;
            const centerY = event.clientY - rect.top;
            const splashRadius =
                ORIGINAL_SPLASH_RADIUS *
                ORIGINAL_SPLASH_RADIUS_SCALE *
                CURRENT_SPLASH_RADIUS_SCALE *
                this.worldScale;

            this.splashActive = true;

            for (const particle of this.particles) {
                const dx = particle.x - centerX;
                const dy = particle.y - centerY;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist > splashRadius) {
                    continue;
                }

                const norm = dist < 0.001 ? 1 : dist;
                const factor = Math.max(0, 1 - dist / splashRadius);
                const impulse = ORIGINAL_SPLASH_STRENGTH * factor * (1.8 + nextRandom() * 0.7) * this.worldScale;

                particle.vx = (dx / norm) * impulse + (nextRandom() - 0.5) * 0.08 * this.worldScale;
                particle.vy = (dy / norm) * impulse - (nextRandom() * 0.12 + 0.04) * this.worldScale;
            }

            this.hoverHue = (this.hoverHue + 42 + nextRandom() * 26) % 360;
        }

        drawRain(dt, timeSeconds) {
            const ctx = this.rainCtx;

            ctx.clearRect(0, 0, this.width, this.height);
            let allStill = true;

            for (const particle of this.particles) {
                const hasVelocity = Math.abs(particle.vx) > 0.01 || Math.abs(particle.vy) > 0.01;

                if (!this.splashActive || !hasVelocity) {
                    particle.y -= particle.speed * dt;
                    particle.x += Math.sin(timeSeconds * 2 + particle.phase) * (0.002 * this.worldScale);
                    particle.x += particle.drift * (0.008 * this.worldScale);
                } else {
                    particle.x += particle.vx * dt;
                    particle.y += particle.vy * dt;

                    const decay = Math.pow(ORIGINAL_SPLASH_DECAY, dt);
                    particle.vx *= decay;
                    particle.vy *= decay;

                    if (Math.abs(particle.vx) < 0.01) {
                        particle.vx = 0;
                    }
                    if (Math.abs(particle.vy) < 0.01) {
                        particle.vy = 0;
                    }
                }

                if (Math.abs(particle.vx) > 0.01 || Math.abs(particle.vy) > 0.01) {
                    allStill = false;
                }

                if (
                    particle.y < -30 ||
                    particle.x < -50 ||
                    particle.x > this.width + 50 ||
                    particle.y > this.height + 65
                ) {
                    this.resetParticle(particle, true);
                    continue;
                }

                const alpha = clamp(particle.alpha + (1 - particle.y / this.height) * 0.12, 0.45, 1);
                ctx.font = "600 " + particle.size.toFixed(1) + "px \"Source Code Pro\", \"Fira Code\", monospace";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.shadowColor = particle.color;
                ctx.shadowBlur = 10;
                ctx.globalAlpha = alpha;
                ctx.fillStyle = particle.color;
                ctx.fillText(particle.char, particle.x, particle.y);
            }

            if (this.splashActive && allStill) {
                this.splashActive = false;
            }

            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;
        }

        drawTrail(dt) {
            const ctx = this.trailCtx;
            ctx.clearRect(0, 0, this.width, this.height);

            let trailWriteIndex = 0;
            for (let i = 0; i < this.trailPoints.length; i++) {
                const point = this.trailPoints[i];
                point.life -= 0.05 * dt;
                if (point.life > 0) {
                    this.trailPoints[trailWriteIndex] = point;
                    trailWriteIndex += 1;
                }
            }
            this.trailPoints.length = trailWriteIndex;

            if (this.trailPoints.length > 1) {
                ctx.beginPath();
                ctx.moveTo(this.trailPoints[0].x, this.trailPoints[0].y);
                for (let i = 1; i < this.trailPoints.length; i++) {
                    ctx.lineTo(this.trailPoints[i].x, this.trailPoints[i].y);
                }
                const first = this.trailPoints[0];
                const last = this.trailPoints[this.trailPoints.length - 1];
                const gradient = ctx.createLinearGradient(first.x, first.y, last.x, last.y);
                gradient.addColorStop(0, "hsla(" + ((this.hoverHue + 320) % 360) + ", 90%, 65%, 0.08)");
                gradient.addColorStop(0.6, "hsla(" + this.hoverHue + ", 95%, 72%, 0.35)");
                gradient.addColorStop(1, "hsla(" + ((this.hoverHue + 30) % 360) + ", 100%, 78%, 0.95)");
                ctx.strokeStyle = gradient;
                ctx.lineWidth = 2.4;
                ctx.lineCap = "round";
                ctx.lineJoin = "round";
                ctx.shadowColor = "hsla(" + this.hoverHue + ", 100%, 70%, 0.85)";
                ctx.shadowBlur = 16;
                ctx.stroke();
                ctx.shadowBlur = 0;
            }

            if (this.pointer && this.isHovering) {
                ctx.beginPath();
                ctx.fillStyle = "hsla(" + ((this.hoverHue + 10) % 360) + ", 100%, 80%, 0.88)";
                ctx.shadowColor = "hsla(" + this.hoverHue + ", 100%, 70%, 0.95)";
                ctx.shadowBlur = 12;
                ctx.arc(this.pointer.x, this.pointer.y, 2.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }

            let sparkleWriteIndex = 0;
            for (let i = 0; i < this.sparkles.length; i++) {
                const sparkle = this.sparkles[i];
                sparkle.x += sparkle.vx * dt;
                sparkle.y += sparkle.vy * dt;
                sparkle.life -= 0.04 * dt;
                sparkle.vx *= 0.97;
                sparkle.vy *= 0.97;

                if (sparkle.life <= 0) {
                    continue;
                }

                ctx.beginPath();
                ctx.globalAlpha = clamp(sparkle.life, 0, 1);
                ctx.fillStyle = sparkle.color;
                ctx.arc(sparkle.x, sparkle.y, sparkle.radius, 0, Math.PI * 2);
                ctx.fill();
                this.sparkles[sparkleWriteIndex] = sparkle;
                sparkleWriteIndex += 1;
            }
            this.sparkles.length = sparkleWriteIndex;
            ctx.globalAlpha = 1;
        }

        update(timestamp) {
            if (!this.enabled || !this.width || !this.height) {
                return;
            }

            if (!this.lastTimestamp) {
                this.lastTimestamp = timestamp;
            }

            const deltaMs = clamp(timestamp - this.lastTimestamp, 8, 34);
            this.lastTimestamp = timestamp;
            const dt = deltaMs / 16.667;
            const timeSeconds = timestamp * 0.001;

            this.drawRain(dt, timeSeconds);
            this.drawTrail(dt);
        }

        destroy() {
            this.detachEvents();
            this.setEnabled(false);
            this.particles.length = 0;
            this.trailPoints.length = 0;
            this.sparkles.length = 0;
            this.width = 0;
            this.height = 0;
            this.rainCanvas.width = 0;
            this.rainCanvas.height = 0;
            this.trailCanvas.width = 0;
            this.trailCanvas.height = 0;
        }
    }

    function createHost() {
        const host = document.createElement("div");
        host.className = "side-rain-host";
        host.dataset.backgroundFlag = String(getSidebarBackgroundFlag());
        host.innerHTML = [
            "<div class=\"code-rain-sidebar code-rain-left\">",
            "  <canvas class=\"code-rain-canvas\"></canvas>",
            "  <canvas class=\"code-rain-trail\"></canvas>",
            "</div>",
            "<div class=\"code-rain-sidebar code-rain-right\">",
            "  <canvas class=\"code-rain-canvas\"></canvas>",
            "  <canvas class=\"code-rain-trail\"></canvas>",
            "</div>"
        ].join("");
        return host;
    }

    function getMainContainer() {
        return document.querySelector(
            ".container-lg, .container-xl, .container-md, .container-sm, .container"
        );
    }

    function initSideCodeRain() {
        const existingController = window[GLOBAL_CONTROLLER_KEY];
        if (!isDesktopEligible()) {
            if (existingController && typeof existingController.destroy === "function") {
                existingController.destroy();
            }
            const triggerButton = document.querySelector(SECRET_TRIGGER_SELECTOR);
            if (triggerButton) {
                triggerButton.style.display = "none";
            }
            return;
        }

        if (existingController && typeof existingController.destroy === "function") {
            existingController.destroy();
        }

        const container = getMainContainer();
        if (!container) {
            return;
        }

        const host = createHost();
        document.body.appendChild(host);
        document.body.classList.add("side-rain-enabled");

        const leftElement = host.querySelector(".code-rain-left");
        const rightElement = host.querySelector(".code-rain-right");
        const panes = [new SidebarCodeRain(leftElement), new SidebarCodeRain(rightElement)];
        const triggerButton = document.querySelector(SECRET_TRIGGER_SELECTOR);
        let animationFrameId = 0;
        let isDestroyed = false;
        let triggerFlashTimeoutId = 0;

        function placePane(element, left, width) {
            element.style.left = Math.floor(left) + "px";
            element.style.width = Math.floor(width) + "px";
        }

        function setBackgroundFlag(flag) {
            const normalizedFlag = normalizeBackgroundFlag(flag);
            currentBackgroundFlag = normalizedFlag;
            host.dataset.backgroundFlag = String(normalizedFlag);
        }

        function flashTriggerButton() {
            if (!triggerButton) {
                return;
            }
            triggerButton.classList.add(SWITCHING_CLASS);
            if (triggerFlashTimeoutId) {
                window.clearTimeout(triggerFlashTimeoutId);
            }
            triggerFlashTimeoutId = window.setTimeout(() => {
                triggerButton.classList.remove(SWITCHING_CLASS);
                triggerFlashTimeoutId = 0;
            }, SWITCHING_CLASS_DURATION_MS);
        }

        function handleTriggerClick() {
            if (!isDesktopEligible()) {
                return;
            }
            setBackgroundFlag((currentBackgroundFlag % 4) + 1);
            flashTriggerButton();
        }

        function syncLayout() {
            if (!isDesktopEligible()) {
                host.style.display = "none";
                panes.forEach((pane) => pane.setEnabled(false));
                return;
            }

            host.style.display = "block";
            const rect = container.getBoundingClientRect();
            const leftWidth = Math.max(0, rect.left - 4);
            const rightWidth = Math.max(0, window.innerWidth - rect.right - 4);

            placePane(leftElement, 0, leftWidth);
            placePane(rightElement, window.innerWidth - rightWidth, rightWidth);

            const leftReady = leftWidth >= MIN_SIDEBAR_WIDTH;
            const rightReady = rightWidth >= MIN_SIDEBAR_WIDTH;
            panes[0].setEnabled(leftReady);
            panes[1].setEnabled(rightReady);
            panes.forEach((pane) => pane.resize());
        }

        function stopAnimation() {
            if (animationFrameId) {
                window.cancelAnimationFrame(animationFrameId);
                animationFrameId = 0;
            }
        }

        function frame(timestamp) {
            if (isDestroyed) {
                return;
            }

            if (document.hidden) {
                animationFrameId = 0;
                return;
            }

            panes.forEach((pane) => pane.update(timestamp));
            animationFrameId = window.requestAnimationFrame(frame);
        }

        function startAnimation() {
            if (!animationFrameId && !document.hidden && !isDestroyed) {
                animationFrameId = window.requestAnimationFrame(frame);
            }
        }

        function handleVisibilityChange() {
            if (document.hidden) {
                stopAnimation();
                return;
            }
            panes.forEach((pane) => {
                pane.lastTimestamp = 0;
            });
            startAnimation();
        }

        function destroy() {
            if (isDestroyed) {
                return;
            }
            isDestroyed = true;
            stopAnimation();
            window.removeEventListener("resize", syncLayout);
            window.removeEventListener("scroll", syncLayout);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            window.removeEventListener("pagehide", destroy);
            if (triggerButton) {
                triggerButton.removeEventListener("click", handleTriggerClick);
                triggerButton.classList.remove(SWITCHING_CLASS);
            }
            if (triggerFlashTimeoutId) {
                window.clearTimeout(triggerFlashTimeoutId);
                triggerFlashTimeoutId = 0;
            }
            panes.forEach((pane) => pane.destroy());
            if (host.parentNode) {
                host.parentNode.removeChild(host);
            }
            document.body.classList.remove("side-rain-enabled");
            if (window[GLOBAL_CONTROLLER_KEY] && window[GLOBAL_CONTROLLER_KEY].destroy === destroy) {
                delete window[GLOBAL_CONTROLLER_KEY];
            }
        }

        setBackgroundFlag(currentBackgroundFlag);
        syncLayout();
        window.addEventListener("resize", syncLayout, { passive: true });
        window.addEventListener("scroll", syncLayout, { passive: true });
        document.addEventListener("visibilitychange", handleVisibilityChange);
        if (triggerButton) {
            triggerButton.addEventListener("click", handleTriggerClick);
        }
        window.addEventListener("pagehide", destroy, { once: true });
        startAnimation();

        window[GLOBAL_CONTROLLER_KEY] = {
            destroy: destroy,
            getBackgroundFlag: () => currentBackgroundFlag,
            setBackgroundFlag: setBackgroundFlag
        };
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initSideCodeRain, { once: true });
    } else {
        initSideCodeRain();
    }
})();
