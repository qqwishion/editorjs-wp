(function (window, document) {
    "use strict";

    function isTrueFlag(value) {
        return value === true || value === 1 || value === "1" || value === "true";
    }

    function getLabel(config, key, fallback) {
        if (config && config.labels && typeof config.labels[key] === "string" && config.labels[key].trim() !== "") {
            return config.labels[key];
        }
        return fallback;
    }

    function getCacheKey(config) {
        const prefix = config && config.cacheKeyPrefix ? config.cacheKeyPrefix : "editorjs_wp_post_";
        if (config && isTrueFlag(config.isNewPostScreen)) {
            return prefix + "new";
        }
        const resolvedPostId = resolvePostId(config);
        return prefix + (resolvedPostId > 0 ? resolvedPostId : "new");
    }

    function toPositiveInt(value) {
        const parsed = parseInt(value, 10);
        return (!isNaN(parsed) && parsed > 0) ? parsed : 0;
    }

    function resolvePostId(config) {
        if (config && isTrueFlag(config.isNewPostScreen)) {
            return 0;
        }

        const fromConfig = toPositiveInt(config && config.postId ? config.postId : 0);
        if (fromConfig > 0) {
            return fromConfig;
        }

        const postIdField = document.getElementById("post_ID");
        if (postIdField && postIdField.value) {
            const fromPostIdField = toPositiveInt(postIdField.value);
            if (fromPostIdField > 0) {
                return fromPostIdField;
            }
        }

        const fallbackField = document.querySelector("input[name='post_id'], input[name='postId']");
        if (fallbackField && fallbackField.value) {
            const fromFallbackField = toPositiveInt(fallbackField.value);
            if (fromFallbackField > 0) {
                return fromFallbackField;
            }
        }

        const search = window && window.location ? window.location.search : "";
        const params = new URLSearchParams(search || "");
        const queryKeys = ["id", "post", "post_id"];
        for (let index = 0; index < queryKeys.length; index += 1) {
            const fromQuery = toPositiveInt(params.get(queryKeys[index]));
            if (fromQuery > 0) {
                return fromQuery;
            }
        }

        return 0;
    }

    function resolveFrontendTitleInput() {
        return document.getElementById("editorjs-wp-post-title")
            || document.getElementById("title")
            || document.querySelector("input[name='title']")
            || document.querySelector("input[name='post_title']")
            || null;
    }

    function getFrontendPostTitle(config, titleInput) {
        if (titleInput && typeof titleInput.value === "string") {
            return titleInput.value.trim();
        }

        if (config && typeof config.postTitle === "string") {
            return config.postTitle.trim();
        }

        return "";
    }

    function resolveFrontendCategorySelect() {
        return document.getElementById("editorjs-wp-post-categories")
            || document.getElementById("topic")
            || document.querySelector("select[name='topic']")
            || null;
    }

    function resolveFrontendFormatSelect() {
        return document.getElementById("editorjs-wp-post-format")
            || document.getElementById("format")
            || document.querySelector("select[name='format']")
            || null;
    }

    function resolveFrontendExcerptInput() {
        return document.getElementById("editorjs-wp-post-excerpt")
            || document.querySelector("textarea[name='excerpt']")
            || null;
    }

    function getFrontendExcerpt(config, excerptInput) {
        if (excerptInput && typeof excerptInput.value === "string") {
            return excerptInput.value;
        }

        if (config && config.postMeta && typeof config.postMeta.excerpt === "string") {
            return config.postMeta.excerpt;
        }

        return "";
    }

    function resolveFrontendTagsInput() {
        return document.getElementById("editorjs-wp-post-tags")
            || document.querySelector("input[name='tags']")
            || document.querySelector("input[name='tags_input']")
            || null;
    }

    function getFrontendTags(config, tagsInput) {
        if (tagsInput && typeof tagsInput.value === "string") {
            return tagsInput.value;
        }

        if (config && config.postMeta && typeof config.postMeta.tags === "string") {
            return config.postMeta.tags;
        }

        return "";
    }

    function resolveFrontendVisibilitySelect() {
        return document.getElementById("editorjs-wp-post-visibility")
            || document.getElementById("access")
            || document.querySelector("select[name='access']")
            || null;
    }

    function resolveFrontendPasswordInput() {
        return document.getElementById("editorjs-wp-post-password")
            || document.querySelector("input[name='post_password']")
            || document.querySelector("input[name='password']")
            || null;
    }

    function getFrontendVisibility(config, visibilitySelect) {
        if (visibilitySelect && typeof visibilitySelect.value === "string" && visibilitySelect.value) {
            return visibilitySelect.value;
        }

        if (config && config.postMeta && typeof config.postMeta.visibility === "string" && config.postMeta.visibility) {
            return config.postMeta.visibility;
        }

        return "public";
    }

    function getFrontendPassword(config, passwordInput) {
        if (passwordInput && typeof passwordInput.value === "string") {
            return passwordInput.value;
        }

        if (config && config.postMeta && typeof config.postMeta.password === "string") {
            return config.postMeta.password;
        }

        return "";
    }

    function resolveFrontendFeaturedImageIdInput() {
        return document.getElementById("editorjs-wp-featured-image-id") || null;
    }

    function getFrontendFeaturedImageId(config, input) {
        if (input && typeof input.value === "string") {
            return String(toPositiveInt(input.value));
        }

        if (config && config.postMeta && toPositiveInt(config.postMeta.featuredImageId) > 0) {
            return String(toPositiveInt(config.postMeta.featuredImageId));
        }

        return "0";
    }

    function normalizeFrontendMetaConfig(config) {
        if (!config || typeof config !== "object") {
            return {
                categoryIds: [],
                format: "standard",
                excerpt: "",
                tags: "",
                visibility: "public",
                password: "",
                featuredImageId: 0,
                featuredImageUrl: "",
                categories: [],
                formats: [{ slug: "standard", label: "РЎС‚Р°РЅРґР°СЂС‚" }],
            };
        }

        if (!config.postMeta || typeof config.postMeta !== "object") {
            config.postMeta = {};
        }

        const postMeta = config.postMeta;

        postMeta.categoryIds = Array.isArray(postMeta.categoryIds) ? postMeta.categoryIds : [];
        postMeta.format = (typeof postMeta.format === "string" && postMeta.format !== "")
            ? postMeta.format
            : "standard";
        postMeta.excerpt = (typeof postMeta.excerpt === "string") ? postMeta.excerpt : "";
        postMeta.tags = (typeof postMeta.tags === "string") ? postMeta.tags : "";
        postMeta.visibility = (typeof postMeta.visibility === "string" && postMeta.visibility !== "")
            ? postMeta.visibility
            : "public";
        postMeta.password = (typeof postMeta.password === "string") ? postMeta.password : "";
        postMeta.featuredImageId = toPositiveInt(postMeta.featuredImageId || 0);
        postMeta.featuredImageUrl = (typeof postMeta.featuredImageUrl === "string") ? postMeta.featuredImageUrl : "";
        postMeta.categories = Array.isArray(postMeta.categories) ? postMeta.categories : [];
        postMeta.formats = Array.isArray(postMeta.formats) ? postMeta.formats : [];

        if (!postMeta.formats.some(function (item) {
            return item && String(item.slug || "") === "standard";
        })) {
            postMeta.formats.unshift({ slug: "standard", label: "РЎС‚Р°РЅРґР°СЂС‚" });
        }

        return postMeta;
    }

    function getFrontendCategoryIds(config, categorySelect) {
        if (categorySelect && categorySelect.options) {
            return Array.from(categorySelect.options)
                .filter(function (option) {
                    return option.selected;
                })
                .map(function (option) {
                    return parseInt(option.value, 10);
                })
                .filter(function (value) {
                    return !isNaN(value) && value > 0;
                });
        }

        const ids = config && config.postMeta && Array.isArray(config.postMeta.categoryIds)
            ? config.postMeta.categoryIds
            : [];

        return ids
            .map(function (value) {
                return parseInt(value, 10);
            })
            .filter(function (value) {
                return !isNaN(value) && value > 0;
            });
    }

    function getFrontendPostFormat(config, formatSelect) {
        if (formatSelect && typeof formatSelect.value === "string") {
            return formatSelect.value || "standard";
        }

        const format = config && config.postMeta && typeof config.postMeta.format === "string"
            ? config.postMeta.format
            : "standard";

        return format || "standard";
    }

    function replaceKnownBrokenLocaleText(rawText) {
        if (typeof rawText !== "string" || rawText === "") {
            return rawText;
        }

        const wrongUrlLabel = "\u041d\u0435\u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u044b\u0439 URL";
        const editButtonLabel = "\u0420\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u043a\u043d\u043e\u043f\u043a\u0443";
        let result = rawText;
        const regexReplacements = [
            { pattern: /URL\s*が\s*間\s*違\s*っ\s*て\s*い\s*ま\s*す/gu, replacement: wrongUrlLabel },
            { pattern: /URL\s*гЃЊ\s*й–“\s*йЃ•\s*гЃЈ\s*гЃ¦\s*гЃ„\s*гЃѕ\s*гЃ™/gu, replacement: wrongUrlLabel },
            { pattern: /Wrong URL/giu, replacement: wrongUrlLabel },
            { pattern: /РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№\s*URL/gu, replacement: wrongUrlLabel },
            { pattern: /ボタンを編集/gu, replacement: editButtonLabel },
            { pattern: /гѓњг‚їгѓіг‚’з·Ёй›†/gu, replacement: editButtonLabel },
            { pattern: /Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ\s*РєРЅРѕРїРєСѓ/gu, replacement: editButtonLabel },
        ];

        regexReplacements.forEach(function (entry) {
            result = result.replace(entry.pattern, entry.replacement);
        });

        return result;
    }

    function patchKnownLocaleGlitches(rootNode) {
        const root = rootNode && typeof rootNode.querySelectorAll === "function" ? rootNode : document.body;
        if (!root) {
            return;
        }

        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        const textNodes = [];
        while (walker.nextNode()) {
            textNodes.push(walker.currentNode);
        }

        textNodes.forEach(function (node) {
            const nextValue = replaceKnownBrokenLocaleText(node.nodeValue || "");
            if (nextValue !== node.nodeValue) {
                node.nodeValue = nextValue;
            }
        });

        root.querySelectorAll("[placeholder], [title], [aria-label]").forEach(function (element) {
            const placeholder = element.getAttribute("placeholder");
            if (placeholder) {
                element.setAttribute("placeholder", replaceKnownBrokenLocaleText(placeholder));
            }

            const title = element.getAttribute("title");
            if (title) {
                element.setAttribute("title", replaceKnownBrokenLocaleText(title));
            }

            const ariaLabel = element.getAttribute("aria-label");
            if (ariaLabel) {
                element.setAttribute("aria-label", replaceKnownBrokenLocaleText(ariaLabel));
            }

            if (element.hasAttribute("value")) {
                const value = element.getAttribute("value");
                if (value) {
                    element.setAttribute("value", replaceKnownBrokenLocaleText(value));
                }
            }
        });
    }

    function clearDraftCache(config) {
        if (!window.localStorage || !config) {
            return;
        }

        try {
            window.localStorage.removeItem(getCacheKey(config));
        } catch (error) {
            // no-op
        }
    }

    function looksLikeMojibake(value) {
        return typeof value === "string" && /(?:\u0420.|\u0421.){2,}/u.test(value);
    }

    function decodeUnicodeEscapes(value) {
        if (typeof value !== "string" || value === "") {
            return value;
        }

        let decoded = value.replace(/\\u([0-9a-fA-F]{4})/g, function (_, hex) {
            return String.fromCharCode(parseInt(hex, 16));
        });

        if (!/[\u0400-\u04FF]/u.test(decoded)) {
            let bareCount = 0;
            const bareDecoded = decoded.replace(/(^|[^\\])u([0-9a-fA-F]{4})/g, function (_, prefix, hex) {
                bareCount += 1;
                return prefix + String.fromCharCode(parseInt(hex, 16));
            });

            if (bareCount >= 2) {
                decoded = bareDecoded;
            }
        }

        return decoded;
    }

    function isDataUrl(value) {
        return typeof value === "string"
            && /^data:[a-z0-9.+-]+\/[a-z0-9.+-]+;base64,/i.test(value);
    }

    function isLikelyUrl(value) {
        return typeof value === "string"
            && /^(https?:\/\/|blob:|\/)/i.test(value);
    }

    function shouldSkipStringNormalization(value, fieldName) {
        if (typeof value !== "string" || value === "") {
            return true;
        }

        if (fieldName && /^(poster|url|link|src|code)$/i.test(fieldName)) {
            return true;
        }

        if (isDataUrl(value) || isLikelyUrl(value)) {
            return true;
        }

        return false;
    }

    function cp1251CodepointToByte(codepoint) {
        if (codepoint <= 0xff) {
            return codepoint;
        }

        if (codepoint === 0x0401) {
            return 0xA8;
        }

        if (codepoint === 0x0451) {
            return 0xB8;
        }

        if (codepoint === 0x2116) {
            return 0xB9;
        }

        if (codepoint >= 0x0410 && codepoint <= 0x044F) {
            return codepoint - 0x0350;
        }

        return -1;
    }

    function repairMojibake(value) {
        if (!looksLikeMojibake(value) || typeof window.TextDecoder !== "function") {
            return value;
        }

        const bytes = new Uint8Array(value.length);
        for (let index = 0; index < value.length; index += 1) {
            const byte = cp1251CodepointToByte(value.charCodeAt(index));
            if (byte < 0) {
                return value;
            }
            bytes[index] = byte;
        }

        try {
            const repaired = new window.TextDecoder("utf-8", { fatal: true }).decode(bytes);
            if (!/[\u0400-\u04FF]/u.test(repaired)) {
                return value;
            }

            const before = (value.match(/(?:\u0420.|\u0421.)/gu) || []).length;
            const after = (repaired.match(/(?:\u0420.|\u0421.)/gu) || []).length;
            if (after >= before) {
                return value;
            }

            return repaired;
        } catch (error) {
            return value;
        }
    }

    function normalizePayloadValue(value, fieldName) {
        if (typeof value === "string") {
            if (shouldSkipStringNormalization(value, fieldName)) {
                return value;
            }

            const decoded = decodeUnicodeEscapes(value);
            return repairMojibake(decoded);
        }

        if (Array.isArray(value)) {
            return value.map(function (item) {
                return normalizePayloadValue(item, fieldName);
            });
        }

        if (value && typeof value === "object") {
            const normalized = {};
            Object.keys(value).forEach(function (key) {
                normalized[key] = normalizePayloadValue(value[key], key);
            });
            return normalized;
        }

        return value;
    }

    function payloadContainsMojibake(value) {
        if (typeof value === "string") {
            return looksLikeMojibake(value);
        }

        if (Array.isArray(value)) {
            return value.some(function (item) {
                return payloadContainsMojibake(item);
            });
        }

        if (value && typeof value === "object") {
            return Object.keys(value).some(function (key) {
                return payloadContainsMojibake(value[key]);
            });
        }

        return false;
    }

    function hasBlocks(payload) {
        return !!(
            payload &&
            Array.isArray(payload.blocks) &&
            payload.blocks.length > 0
        );
    }

    function parseCache(config) {
        if (!window.localStorage || !config) {
            return null;
        }

        const key = getCacheKey(config);
        const raw = window.localStorage.getItem(key);
        if (!raw) {
            return null;
        }

        try {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.data && Array.isArray(parsed.data.blocks)) {
                parsed.data = normalizePayloadValue(parsed.data);
                if (payloadContainsMojibake(parsed.data)) {
                    clearDraftCache(config);
                    return null;
                }
                return parsed;
            }
        } catch (error) {
            return null;
        }

        return null;
    }

    function isCacheFresh(config, cachedDraft) {
        const savedAt = parseInt(cachedDraft && cachedDraft.savedAt ? cachedDraft.savedAt : 0, 10);
        if (isNaN(savedAt) || savedAt <= 0) {
            return false;
        }

        const maxAge = parseInt(
            (config && config.cacheMaxAgeMs) ? config.cacheMaxAgeMs : (6 * 60 * 60 * 1000),
            10
        );
        if (isNaN(maxAge) || maxAge <= 0) {
            return false;
        }

        return (Date.now() - savedAt) <= maxAge;
    }

    function shouldRestoreFromCache(config, cachedDraft, currentData) {
        if (!cachedDraft || !hasBlocks(cachedDraft.data) || !isCacheFresh(config, cachedDraft)) {
            return false;
        }

        if (payloadContainsMojibake(cachedDraft.data)) {
            clearDraftCache(config);
            return false;
        }

        // Never overwrite non-empty server data with local cache.
        if (hasBlocks(currentData)) {
            return false;
        }

        // New post drafts require explicit confirmation to avoid accidental stale restore.
        if (isTrueFlag(config.isNewPostScreen)) {
            const message = getLabel(config, "restoreNewPostConfirm", "A local draft was found for this new post. Restore it?");
            return window.confirm(message);
        }

        return true;
    }

    function installSlashShortcut(holder) {
        if (!holder) {
            return;
        }

        holder.addEventListener("keydown", function (event) {
            if (event.key !== "/") {
                return;
            }

            const active = document.activeElement;
            if (!active || typeof active.closest !== "function") {
                return;
            }

            const editable = active.matches("[contenteditable='true']")
                ? active
                : active.closest("[contenteditable='true']");

            if (!editable) {
                return;
            }

            const text = (editable.textContent || "").replace(/\u200b/g, "").trim();
            if (text !== "") {
                return;
            }

            const plusButton = holder.querySelector(".ce-toolbar__plus");
            if (!plusButton) {
                return;
            }

            event.preventDefault();
            plusButton.click();
        });
    }

    function enforceTableCellEditability(holder) {
        if (!holder || typeof holder.querySelectorAll !== "function") {
            return;
        }

        holder.querySelectorAll(".tc-cell").forEach(function (cell) {
            if (!cell) {
                return;
            }

            if (cell.getAttribute("contenteditable") !== "true") {
                cell.setAttribute("contenteditable", "true");
            }

            cell.classList.add("editorjs-wp-table-cell-editable");
        });
    }

    function enforceEditorInputEditability(holder) {
        if (!holder || typeof holder.querySelectorAll !== "function") {
            return;
        }

        holder.querySelectorAll("[contenteditable], .ce-paragraph, .ce-header, .ce-code__textarea, .tc-cell").forEach(function (node) {
            if (!node) {
                return;
            }

            const attr = node.getAttribute("contenteditable");
            if (attr === "false") {
                node.setAttribute("contenteditable", "true");
            }

            if (node.getAttribute("contenteditable") === "true") {
                node.classList.add("editorjs-wp-content-editable");
            }
        });
    }

    function markQuoteBlockContent(holder) {
        if (!holder || typeof holder.querySelectorAll !== "function") {
            return;
        }

        holder.querySelectorAll(".ce-block__content").forEach(function (content) {
            if (!content || !content.classList) {
                return;
            }

            if (content.querySelector(".cdx-quote")) {
                content.classList.add("editorjs-wp-quote-block-content");
            } else {
                content.classList.remove("editorjs-wp-quote-block-content");
            }
        });
    }

    function parseData(raw, fallback) {
        if (!raw) {
            return normalizePayloadValue(fallback);
        }

        try {
            const parsed = JSON.parse(raw);
            if (parsed && Array.isArray(parsed.blocks)) {
                return normalizePayloadValue(parsed);
            }
        } catch (error) {
            return normalizePayloadValue(fallback);
        }

        return normalizePayloadValue(fallback);
    }

    function stringifyData(data, fallback) {
        try {
            return JSON.stringify(data || fallback || {});
        } catch (error) {
            return JSON.stringify(fallback || {});
        }
    }

    function findFrontendMountNode() {
        const contentTextarea = document.querySelector("form textarea[name='content'], form #content");
        if (contentTextarea) {
            return contentTextarea.closest("form") || contentTextarea.parentElement || document.body;
        }

        return document.querySelector("main")
            || document.querySelector(".site-main")
            || document.querySelector("#primary")
            || document.querySelector("article")
            || document.querySelector(".content")
            || document.body;
    }

    function createFrontendEditorShell(config, fallbackData) {
        const mountNode = findFrontendMountNode();
        if (!mountNode) {
            return null;
        }

        const shell = document.createElement("div");
        shell.className = "editorjs-wp-admin-shell editorjs-wp-frontend-shell";

        const toolbar = document.createElement("div");
        toolbar.className = "editorjs-wp-admin-toolbar editorjs-wp-admin-toolbar--frontend-actions publish-form__actions";

        const controls = document.createElement("div");
        controls.className = "editorjs-wp-frontend-controls";

        const autosaveStatusNode = document.createElement("div");
        autosaveStatusNode.id = "editorjs-wp-autosave-status";
        autosaveStatusNode.className = "editorjs-wp-autosave-status";
        autosaveStatusNode.dataset.state = "idle";
        autosaveStatusNode.textContent = getLabel(config, "autosaveIdle", "Autosave ready");

        const saveButton = document.createElement("button");
        saveButton.type = "button";
        saveButton.id = "editorjs-wp-frontend-save";
        saveButton.className = "editorjs-wp-frontend-save-button";
        saveButton.textContent = getLabel(config, "frontendSave", "Save changes");

        const previewButton = document.createElement("button");
        previewButton.type = "button";
        previewButton.id = "editorjs-wp-frontend-preview";
        previewButton.className = "editorjs-wp-frontend-save-button editorjs-wp-frontend-preview-button";
        previewButton.textContent = getLabel(config, "frontendPreview", "Preview");

        const publishButton = document.createElement("button");
        publishButton.type = "button";
        publishButton.id = "editorjs-wp-frontend-publish";
        publishButton.className = "editorjs-wp-frontend-save-button editorjs-wp-frontend-publish-button";
        publishButton.textContent = getLabel(config, "frontendPublish", "Publish");

        controls.appendChild(autosaveStatusNode);
        controls.appendChild(saveButton);
        controls.appendChild(previewButton);
        controls.appendChild(publishButton);

        toolbar.appendChild(controls);

        const hiddenField = document.createElement("textarea");
        hiddenField.id = "editorjs_wp_data";
        hiddenField.className = "editorjs-wp-hidden";
        hiddenField.value = stringifyData(config.editorData, fallbackData);

        const holder = document.createElement("div");
        holder.id = "editorjs-wp-holder";
        holder.setAttribute("aria-label", "Editor.js content editor");

        const saveResultNode = document.createElement("div");
        saveResultNode.id = "editorjs-wp-frontend-save-result";
        saveResultNode.className = "editorjs-wp-frontend-save-result";
        saveResultNode.setAttribute("aria-live", "polite");

        shell.appendChild(hiddenField);
        shell.appendChild(holder);
        shell.appendChild(toolbar);
        shell.appendChild(saveResultNode);

        if (mountNode.firstChild) {
            mountNode.insertBefore(shell, mountNode.firstChild);
        } else {
            mountNode.appendChild(shell);
        }

        return {
            holder: holder,
            hiddenField: hiddenField,
            autosaveStatusNode: autosaveStatusNode,
            saveButton: saveButton,
            previewButton: previewButton,
            publishButton: publishButton,
            saveResultNode: saveResultNode,
            titleInput: null,
            categorySelect: null,
            formatSelect: null,
        };
    }

    function shouldSkipLegacyNode(node) {
        if (!node || typeof node.closest !== "function") {
            return true;
        }

        if (node === document.body || node === document.documentElement) {
            return true;
        }

        if (node.closest(".editorjs-wp-admin-shell")) {
            return true;
        }

        if (
            node.classList
            && Array.from(node.classList).some(function (className) {
                return typeof className === "string" && className.indexOf("editorjs-wp-") === 0;
            })
        ) {
            return true;
        }

        if (node.id === "editorjs-wp-holder" || node.id === "editorjs_wp_data") {
            return true;
        }

        return false;
    }

    function nodeHasPublishControls(node) {
        if (!node) {
            return false;
        }

        const controls = [];
        if (node.matches && node.matches("button, input, a")) {
            controls.push(node);
        }

        if (typeof node.querySelectorAll === "function") {
            node.querySelectorAll("button, input[type='submit'], input[type='button'], a").forEach(function (control) {
                controls.push(control);
            });
        }

        return controls.some(function (control) {
            const text = (
                (control.textContent || "")
                + " "
                + (control.value || "")
                + " "
                + (control.name || "")
                + " "
                + (control.id || "")
                + " "
                + (control.className || "")
                + " "
                + (control.getAttribute && control.getAttribute("data-action") ? control.getAttribute("data-action") : "")
            ).toLowerCase();

            return /(publish|preview|submit|update|save|\u043e\u043f\u0443\u0431\u043b\u0438\u043a\u043e\u0432\u0430\u0442\u044c|\u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440\u0435\u0442\u044c|\u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c)/.test(text);
        });
    }

    function hideLegacyFrontendEditors(config, shell) {
        if (!isTrueFlag(config && config.isFrontendEditor) || !shell) {
            return;
        }

        const hideSelectors = [
            "textarea[name='content']",
            "#content",
            ".wp-editor-wrap",
            "#postdivrich",
            ".edit-post-layout",
            ".block-editor-writing-flow",
            "[id*='gutenberg']",
            "[class*='gutenberg']",
            ".frontend-editor",
            ".frontend-editor-content",
            ".publish-editor",
            ".publish-editor-content",
            "[id*='frontend-editor']",
            "[id*='publish-editor']",
        ];

        hideSelectors.forEach(function (selector) {
            const nodes = document.querySelectorAll(selector);
            nodes.forEach(function (node) {
                if (shouldSkipLegacyNode(node)) {
                    return;
                }

                const wrapper = node.closest(
                    ".wp-editor-wrap, #postdivrich, .editor-container, .editor-wrap, .frontend-editor-content, .publish-editor-content, [data-editor='content'], .content-editor"
                );
                const target = wrapper && !shouldSkipLegacyNode(wrapper) ? wrapper : node;

                if (nodeHasPublishControls(target)) {
                    node.classList.add("editorjs-wp-legacy-hidden");
                    return;
                }

                target.classList.add("editorjs-wp-legacy-hidden");
            });
        });
    }

    function hideLegacySubmitControls(config, shell) {
        if (!isTrueFlag(config && config.isFrontendEditor) || !shell) {
            return;
        }

        const forms = Array.from(document.querySelectorAll("form")).filter(function (form) {
            if (!form || typeof form.querySelector !== "function") {
                return false;
            }

            // Never touch controls inside our Editor.js frontend shell.
            const formShell = form.closest(".editorjs-wp-admin-shell");
            if (formShell && (formShell === shell || formShell.contains(shell) || shell.contains(formShell))) {
                return false;
            }

            if (form.contains(shell)) {
                return false;
            }

            return !!form.querySelector(
                "textarea[name='content'], #content, .wp-editor-wrap, [class*='frontend-editor'], [class*='publish-editor'], [class*='editor']"
            );
        });

        forms.forEach(function (form) {
            form.querySelectorAll("button, input[type='submit'], input[type='button'], a").forEach(function (control) {
                const text = (
                    (control.textContent || "")
                    + " "
                    + (control.value || "")
                    + " "
                    + (control.name || "")
                    + " "
                    + (control.id || "")
                    + " "
                    + (control.className || "")
                ).toLowerCase();

                if (/(publish|preview|submit|update|save|\u043e\u043f\u0443\u0431\u043b\u0438\u043a\u043e\u0432\u0430\u0442\u044c|\u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440\u0435\u0442\u044c|\u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c)/.test(text)) {
                    control.classList.add("editorjs-wp-legacy-hidden");
                }
            });
        });
    }

    function stripLegacyFrontendTemplate(config, shell) {
        if (!isTrueFlag(config && config.isFrontendEditor) || !shell) {
            return;
        }

        // Our dedicated frontend editor page already renders a clean template.
        // Do not hide sibling fields there, otherwise custom publish form inputs disappear.
        if (
            document.body
            && document.body.classList
            && document.body.classList.contains("editorjs-wp-frontend-editor-page")
        ) {
            return;
        }

        if (document.body) {
            document.body.classList.add("editorjs-wp-frontend-mode-active");
        }

        const scopes = [];
        const formScope = shell.closest("form");
        if (formScope) {
            scopes.push(formScope);
        }
        if (shell.parentElement && scopes.indexOf(shell.parentElement) === -1) {
            scopes.push(shell.parentElement);
        }

        scopes.forEach(function (scopeNode) {
            if (!scopeNode || typeof scopeNode.querySelectorAll !== "function") {
                return;
            }

            scopeNode.classList.add("editorjs-wp-frontend-strip");

            Array.from(scopeNode.children).forEach(function (child) {
                if (!child || child === shell || child.contains(shell)) {
                    return;
                }

                if (child.matches && child.matches("script, style, link, meta, noscript")) {
                    return;
                }

                child.classList.add("editorjs-wp-legacy-hidden");
            });

            const selectors = [
                "#titlediv",
                "#titlewrap",
                "[name='title']",
                "[name='post_title']",
                "[name='format']",
                "[name='post_format']",
                ".post-formats",
                ".post-format",
                ".frontend-editor",
                ".publish-editor",
                ".editor-wrap",
                ".wp-editor-wrap",
                ".field",
                ".form-group",
                ".form-field",
                ".input-group",
                "label",
                "textarea",
                "select",
                "input[type='text']",
                "input[type='url']",
                "input[type='search']",
            ];

            scopeNode.querySelectorAll(selectors.join(",")).forEach(function (node) {
                if (!node || shouldSkipLegacyNode(node) || node.closest(".editorjs-wp-admin-shell")) {
                    return;
                }

                const wrapper = node.closest(
                    "#titlediv, #titlewrap, .post-formats, .post-format, .wp-editor-wrap, .frontend-editor, .publish-editor, .editor-wrap, .field, .form-group, .form-field, .input-group"
                );
                const target = wrapper && !wrapper.contains(shell) ? wrapper : node;
                if (!target.contains(shell)) {
                    target.classList.add("editorjs-wp-legacy-hidden");
                }
            });
        });
    }

    function mergeTools(baseTools, extensionTools) {
        if (!extensionTools || typeof extensionTools !== "object") {
            return baseTools;
        }
        return Object.assign({}, baseTools, extensionTools);
    }

    function resolveGlobalFunction(functionName) {
        if (!functionName || typeof functionName !== "string") {
            return null;
        }

        const path = functionName.split(".");
        let current = window;
        for (let index = 0; index < path.length; index += 1) {
            if (!current || (typeof current !== "object" && typeof current !== "function")) {
                return null;
            }
            current = current[path[index]];
        }

        return typeof current === "function" ? current : null;
    }

    function buildTools(config) {
        const baseTools = typeof window.EditorJSWPToolsFactory === "function"
            ? window.EditorJSWPToolsFactory(config)
            : {};

        let mergedTools = Object.assign({}, baseTools);

        if (typeof window.EditorJSWPExternalToolsFactory === "function") {
            try {
                mergedTools = mergeTools(
                    mergedTools,
                    window.EditorJSWPExternalToolsFactory(config, mergedTools)
                );
            } catch (error) {
                if (window.console && typeof window.console.warn === "function") {
                    window.console.warn("[EditorJS WP] External tools factory failed:", error);
                }
            }
        }

        if (Array.isArray(config.externalToolFactoryNames)) {
            config.externalToolFactoryNames.forEach(function (factoryName) {
                const factory = resolveGlobalFunction(factoryName);
                if (typeof factory === "function") {
                    try {
                        mergedTools = mergeTools(
                            mergedTools,
                            factory(config, mergedTools)
                        );
                    } catch (error) {
                        if (window.console && typeof window.console.warn === "function") {
                            window.console.warn("[EditorJS WP] Tool factory failed:", factoryName, error);
                        }
                    }
                }
            });
        }

        if (!mergedTools.paragraph && typeof window.Paragraph === "function") {
            mergedTools.paragraph = {
                class: window.Paragraph,
                inlineToolbar: ["bold", "italic", "link"],
            };
        }

        return mergedTools;
    }

    function getFrontendActionName(config, key, fallback) {
        if (config && config.actions && typeof config.actions[key] === "string" && config.actions[key].trim() !== "") {
            return config.actions[key];
        }

        return fallback;
    }

    function resolveAjaxNonce(config) {
        if (!config || isTrueFlag(config.isFrontendEditor)) {
            return "";
        }

        return (typeof config.nonce === "string") ? config.nonce : "";
    }

    function callFrontendAction(config, endpointKey, actionName, editorData, errorLabelKey, fallbackErrorMessage) {
        const endpoint = config && config.endpoints
            ? (config.endpoints[endpointKey] || config.endpoints.frontendSave || "")
            : "";

        if (!endpoint) {
            return Promise.reject(new Error(getLabel(config, errorLabelKey, fallbackErrorMessage)));
        }

        const formData = new FormData();
        const resolvedPostId = resolvePostId(config);
        if (config && resolvedPostId > 0) {
            config.postId = resolvedPostId;
        }

        const titleInput = resolveFrontendTitleInput();
        const categorySelect = resolveFrontendCategorySelect();
        const formatSelect = resolveFrontendFormatSelect();
        const excerptInput = resolveFrontendExcerptInput();
        const tagsInput = resolveFrontendTagsInput();
        const visibilitySelect = resolveFrontendVisibilitySelect();
        const passwordInput = resolveFrontendPasswordInput();
        const featuredImageIdInput = resolveFrontendFeaturedImageIdInput();
        const ajaxNonce = resolveAjaxNonce(config);

        formData.append("action", actionName);
        if (ajaxNonce !== "") {
            formData.append("_ajax_nonce", ajaxNonce);
        }
        formData.append("postId", String(resolvedPostId));
        formData.append("postTitle", getFrontendPostTitle(config, titleInput));
        formData.append("postExcerpt", getFrontendExcerpt(config, excerptInput));
        formData.append("postCategoryIds", JSON.stringify(getFrontendCategoryIds(config, categorySelect)));
        formData.append("postFormat", getFrontendPostFormat(config, formatSelect));
        formData.append("postTags", getFrontendTags(config, tagsInput));
        formData.append("postVisibility", getFrontendVisibility(config, visibilitySelect));
        formData.append("postPassword", getFrontendPassword(config, passwordInput));
        formData.append("postFeaturedImageId", getFrontendFeaturedImageId(config, featuredImageIdInput));

        if (editorData && typeof editorData === "object") {
            formData.append("editorData", JSON.stringify(editorData));
        }

        return fetch(endpoint, {
            method: "POST",
            credentials: "same-origin",
            headers: {
                Accept: "application/json",
            },
            body: formData,
        }).then(function (response) {
            return response.text().then(function (rawBody) {
                let payload = null;
                try {
                    payload = rawBody ? JSON.parse(rawBody) : null;
                } catch (parseError) {
                    const firstBrace = typeof rawBody === "string" ? rawBody.indexOf("{") : -1;
                    if (firstBrace > -1) {
                        try {
                            payload = JSON.parse(rawBody.slice(firstBrace));
                        } catch (nestedParseError) {
                            payload = null;
                        }
                    }
                }

                if (!response.ok || !payload || payload.success !== true) {
                    const message =
                        payload && payload.data && payload.data.message
                            ? payload.data.message
                            : getLabel(config, errorLabelKey, fallbackErrorMessage);
                    throw new Error(message);
                }
                return payload.data || {};
            });
        });
    }

    function callFrontendSave(config, editorData) {
        return callFrontendAction(
            config,
            "frontendSave",
            getFrontendActionName(config, "frontendSave", "editorjs_wp_frontend_save"),
            editorData,
            "frontendSaveError",
            "Unable to save changes."
        );
    }

    function callFrontendPreview(config, editorData) {
        return callFrontendAction(
            config,
            "frontendPreview",
            getFrontendActionName(config, "frontendPreview", "editorjs_wp_frontend_preview"),
            editorData,
            "frontendPreviewError",
            "Unable to open preview."
        );
    }

    function callFrontendPublish(config, editorData) {
        return callFrontendAction(
            config,
            "frontendPublish",
            getFrontendActionName(config, "frontendPublish", "editorjs_wp_frontend_publish"),
            editorData,
            "frontendPublishError",
            "Unable to publish post."
        );
    }

    document.addEventListener("DOMContentLoaded", function () {
        const bootEditor = function () {
        const config = window.EditorJSWPConfig || null;
        const fallbackData = {
            time: Date.now(),
            blocks: [],
            version: "2.31.4",
        };

        let holder = document.getElementById("editorjs-wp-holder");
        let hiddenDataField = document.getElementById("editorjs_wp_data");
        let autosaveStatusNode = document.getElementById("editorjs-wp-autosave-status");
        let frontendSaveButton = document.getElementById("editorjs-wp-frontend-save");
        let frontendPreviewButton = document.getElementById("editorjs-wp-frontend-preview");
        let frontendPublishButton = document.getElementById("editorjs-wp-frontend-publish");
        let frontendSaveResult = document.getElementById("editorjs-wp-frontend-save-result");
        let frontendTitleInput = resolveFrontendTitleInput();
        let frontendCategorySelect = resolveFrontendCategorySelect();
        let frontendFormatSelect = resolveFrontendFormatSelect();
        let frontendExcerptInput = resolveFrontendExcerptInput();
        let frontendTagsInput = resolveFrontendTagsInput();
        let frontendVisibilitySelect = resolveFrontendVisibilitySelect();
        let frontendPasswordInput = resolveFrontendPasswordInput();
        let frontendFeaturedImageIdInput = resolveFrontendFeaturedImageIdInput();

        if (config && isTrueFlag(config.isFrontendEditor) && (!holder || !hiddenDataField)) {
            const injectedShell = createFrontendEditorShell(config, fallbackData);
            if (injectedShell) {
                holder = injectedShell.holder;
                hiddenDataField = injectedShell.hiddenField;
                autosaveStatusNode = injectedShell.autosaveStatusNode;
                frontendSaveButton = injectedShell.saveButton;
                frontendPreviewButton = injectedShell.previewButton;
                frontendPublishButton = injectedShell.publishButton;
                frontendSaveResult = injectedShell.saveResultNode;
                frontendTitleInput = injectedShell.titleInput;
                frontendCategorySelect = injectedShell.categorySelect;
                frontendFormatSelect = injectedShell.formatSelect;
                frontendExcerptInput = resolveFrontendExcerptInput();
                frontendTagsInput = resolveFrontendTagsInput();
                frontendVisibilitySelect = resolveFrontendVisibilitySelect();
                frontendPasswordInput = resolveFrontendPasswordInput();
                frontendFeaturedImageIdInput = resolveFrontendFeaturedImageIdInput();
            }
        }

        if (!config || !holder || !hiddenDataField || typeof window.EditorJS !== "function") {
            return;
        }

        const frontendShell = holder.closest(".editorjs-wp-admin-shell");
        if (frontendShell) {
            hideLegacyFrontendEditors(config, frontendShell);
            hideLegacySubmitControls(config, frontendShell);
            patchKnownLocaleGlitches(frontendShell);
        }

        function ensureFrontendMetaFields(shell) {
            if (!isTrueFlag(config.isFrontendEditor) || !shell) {
                return {
                    titleInput: resolveFrontendTitleInput(),
                    categorySelect: resolveFrontendCategorySelect(),
                    formatSelect: resolveFrontendFormatSelect(),
                    excerptInput: resolveFrontendExcerptInput(),
                    tagsInput: resolveFrontendTagsInput(),
                    visibilitySelect: resolveFrontendVisibilitySelect(),
                    passwordInput: resolveFrontendPasswordInput(),
                    featuredImageIdInput: resolveFrontendFeaturedImageIdInput(),
                };
            }

            const hasPublishForm = !!shell.querySelector(".publish-form");
            const existingTitleInput = resolveFrontendTitleInput();
            const existingCategorySelect = resolveFrontendCategorySelect();
            const existingFormatSelect = resolveFrontendFormatSelect();
            const existingExcerptInput = resolveFrontendExcerptInput();
            const existingTagsInput = resolveFrontendTagsInput();
            const existingVisibilitySelect = resolveFrontendVisibilitySelect();
            const existingPasswordInput = resolveFrontendPasswordInput();
            const existingFeaturedImageIdInput = resolveFrontendFeaturedImageIdInput();

            // When a publish form already exists on page, reuse it and do not create extra fields.
            if (hasPublishForm) {
                if (existingTitleInput && typeof config.postTitle === "string" && config.postTitle !== "" && !existingTitleInput.value) {
                    existingTitleInput.value = config.postTitle;
                }

                if (existingCategorySelect) {
                    config.postMeta = config.postMeta || {};
                    config.postMeta.categoryIds = getFrontendCategoryIds(config, existingCategorySelect);
                }

                if (existingFormatSelect) {
                    config.postMeta = config.postMeta || {};
                    config.postMeta.format = getFrontendPostFormat(config, existingFormatSelect);
                }

                return {
                    titleInput: existingTitleInput,
                    categorySelect: existingCategorySelect,
                    formatSelect: existingFormatSelect,
                    excerptInput: existingExcerptInput,
                    tagsInput: existingTagsInput,
                    visibilitySelect: existingVisibilitySelect,
                    passwordInput: existingPasswordInput,
                    featuredImageIdInput: existingFeaturedImageIdInput,
                };
            }

            const postMeta = normalizeFrontendMetaConfig(config);
            const holderNode = shell.querySelector("#editorjs-wp-holder") || holder;
            const hiddenNode = shell.querySelector("#editorjs_wp_data") || hiddenDataField;

            let metaWrap = shell.querySelector(".editorjs-wp-post-meta");
            if (!metaWrap) {
                metaWrap = document.createElement("div");
                metaWrap.className = "editorjs-wp-post-meta";

                if (holderNode && holderNode.parentNode) {
                    holderNode.parentNode.insertBefore(metaWrap, hiddenNode && hiddenNode.parentNode === holderNode.parentNode ? hiddenNode : holderNode);
                } else {
                    shell.appendChild(metaWrap);
                }
            }

            let titleInput = shell.querySelector("#editorjs-wp-post-title");
            if (!titleInput) {
                const titleField = document.createElement("div");
                titleField.className = "editorjs-wp-post-meta-field editorjs-wp-post-meta-field--title";

                titleInput = document.createElement("input");
                titleInput.type = "text";
                titleInput.id = "editorjs-wp-post-title";
                titleInput.className = "editorjs-wp-post-title";
                titleInput.autocomplete = "off";

                titleField.appendChild(titleInput);
                metaWrap.appendChild(titleField);
            }

            if (typeof config.postTitle === "string") {
                titleInput.value = config.postTitle;
            } else if (titleInput.value) {
                config.postTitle = titleInput.value;
            }

            if (titleInput.dataset.editorjsBound !== "1") {
                titleInput.addEventListener("input", function () {
                    config.postTitle = titleInput.value || "";
                });
                titleInput.dataset.editorjsBound = "1";
            }

            let categorySelect = shell.querySelector("#editorjs-wp-post-categories");
            if (!categorySelect) {
                let optionsRow = shell.querySelector(".editorjs-wp-post-options-row");
                if (!optionsRow) {
                    optionsRow = document.createElement("div");
                    optionsRow.className = "editorjs-wp-post-options-row";
                    metaWrap.appendChild(optionsRow);
                }

                const categoriesField = document.createElement("div");
                categoriesField.className = "editorjs-wp-post-meta-field editorjs-wp-post-meta-field--categories";

                const categoriesLabel = document.createElement("label");
                categoriesLabel.className = "editorjs-wp-post-meta-label";
                categoriesLabel.setAttribute("for", "editorjs-wp-post-categories");
                categoriesLabel.textContent = getLabel(config, "frontendCategoriesLabel", "Рубрика");

                categorySelect = document.createElement("select");
                categorySelect.id = "editorjs-wp-post-categories";
                categorySelect.className = "editorjs-wp-post-meta-select";
                categorySelect.multiple = false;

                categoriesField.appendChild(categoriesLabel);
                categoriesField.appendChild(categorySelect);
                optionsRow.appendChild(categoriesField);
            }

            const selectedCategoryIds = postMeta.categoryIds
                .map(function (value) {
                    return parseInt(value, 10);
                })
                .filter(function (value) {
                    return !isNaN(value) && value > 0;
                });
            const selectedCategoryId = selectedCategoryIds.length > 0 ? selectedCategoryIds[0] : 0;

            categorySelect.innerHTML = "";
            postMeta.categories.forEach(function (category) {
                const categoryId = parseInt(category && category.id ? category.id : 0, 10);
                if (isNaN(categoryId) || categoryId <= 0) {
                    return;
                }

                const option = document.createElement("option");
                option.value = String(categoryId);
                option.textContent = String(category && category.name ? category.name : ("РљР°С‚РµРіРѕСЂРёСЏ #" + categoryId));
                option.selected = selectedCategoryId > 0 && categoryId === selectedCategoryId;
                categorySelect.appendChild(option);
            });

            config.postMeta.categoryIds = getFrontendCategoryIds(config, categorySelect);

            if (categorySelect.dataset.editorjsBound !== "1") {
                categorySelect.addEventListener("change", function () {
                    config.postMeta.categoryIds = getFrontendCategoryIds(config, categorySelect);
                });
                categorySelect.dataset.editorjsBound = "1";
            }

            let formatSelect = shell.querySelector("#editorjs-wp-post-format");
            if (!formatSelect) {
                let optionsRow = shell.querySelector(".editorjs-wp-post-options-row");
                if (!optionsRow) {
                    optionsRow = document.createElement("div");
                    optionsRow.className = "editorjs-wp-post-options-row";
                    metaWrap.appendChild(optionsRow);
                }

                const formatField = document.createElement("div");
                formatField.className = "editorjs-wp-post-meta-field editorjs-wp-post-meta-field--format";

                const formatLabel = document.createElement("label");
                formatLabel.className = "editorjs-wp-post-meta-label";
                formatLabel.setAttribute("for", "editorjs-wp-post-format");
                formatLabel.textContent = getLabel(config, "frontendFormatLabel", "Р¤РѕСЂРјР°С‚");

                formatSelect = document.createElement("select");
                formatSelect.id = "editorjs-wp-post-format";
                formatSelect.className = "editorjs-wp-post-meta-select";

                formatField.appendChild(formatLabel);
                formatField.appendChild(formatSelect);
                optionsRow.appendChild(formatField);
            }

            const formats = postMeta.formats.length
                ? postMeta.formats
                : [{ slug: "standard", label: "РЎС‚Р°РЅРґР°СЂС‚" }];

            const currentFormat = (typeof postMeta.format === "string" && postMeta.format !== "")
                ? postMeta.format
                : "standard";

            formatSelect.innerHTML = "";
            formats.forEach(function (formatItem) {
                const slug = String(formatItem && formatItem.slug ? formatItem.slug : "");
                if (slug === "") {
                    return;
                }

                const option = document.createElement("option");
                option.value = slug;
                option.textContent = String(formatItem && formatItem.label ? formatItem.label : slug);
                option.selected = slug === currentFormat;
                formatSelect.appendChild(option);
            });

            if (!formatSelect.value && formatSelect.options.length > 0) {
                formatSelect.selectedIndex = 0;
            }

            config.postMeta.format = formatSelect.value || "standard";

            if (formatSelect.dataset.editorjsBound !== "1") {
                formatSelect.addEventListener("change", function () {
                    config.postMeta.format = formatSelect.value || "standard";
                });
                formatSelect.dataset.editorjsBound = "1";
            }

            return {
                titleInput: titleInput,
                categorySelect: categorySelect,
                formatSelect: formatSelect,
                excerptInput: resolveFrontendExcerptInput(),
                tagsInput: resolveFrontendTagsInput(),
                visibilitySelect: resolveFrontendVisibilitySelect(),
                passwordInput: resolveFrontendPasswordInput(),
                featuredImageIdInput: resolveFrontendFeaturedImageIdInput(),
            };
        }

        let initialData = config.editorData || fallbackData;
        if (!initialData || !Array.isArray(initialData.blocks)) {
            initialData = parseData(hiddenDataField.value, fallbackData);
        }
        initialData = normalizePayloadValue(initialData);
        hiddenDataField.value = stringifyData(initialData, fallbackData);

        const resolvedPostId = resolvePostId(config);
        if (!isTrueFlag(config.isNewPostScreen) && resolvedPostId > 0) {
            config.postId = resolvedPostId;
        }

        const cachedDraft = parseCache(config);
        if (shouldRestoreFromCache(config, cachedDraft, initialData)) {
            const cachedData = cachedDraft.data;
            initialData = cachedData;
            hiddenDataField.value = JSON.stringify(cachedData);
        }

        const tools = buildTools(config);

        let editorInstance;
        const autosaveInstanceHolder = { instance: null };
        let isProgrammaticSubmit = false;

        function setFrontendSaveResult(message, isError) {
            if (!frontendSaveResult) {
                return;
            }

            frontendSaveResult.textContent = message || "";
            frontendSaveResult.classList.toggle("is-error", !!isError);
            frontendSaveResult.classList.toggle("is-success", !isError && !!message);
        }

        function ensureFrontendSaveControls() {
            if (!isTrueFlag(config.isFrontendEditor)) {
                return;
            }

            const shell = holder.closest(".editorjs-wp-admin-shell") || holder.parentElement;
            if (!shell) {
                return;
            }

            const ensuredMeta = ensureFrontendMetaFields(shell);
            if (ensuredMeta) {
                frontendTitleInput = ensuredMeta.titleInput || frontendTitleInput;
                frontendCategorySelect = ensuredMeta.categorySelect || frontendCategorySelect;
                frontendFormatSelect = ensuredMeta.formatSelect || frontendFormatSelect;
                frontendExcerptInput = ensuredMeta.excerptInput || frontendExcerptInput;
                frontendTagsInput = ensuredMeta.tagsInput || frontendTagsInput;
                frontendVisibilitySelect = ensuredMeta.visibilitySelect || frontendVisibilitySelect;
                frontendPasswordInput = ensuredMeta.passwordInput || frontendPasswordInput;
                frontendFeaturedImageIdInput = ensuredMeta.featuredImageIdInput || frontendFeaturedImageIdInput;
            }

            if (frontendSaveButton && frontendPreviewButton && frontendPublishButton && frontendSaveResult && autosaveStatusNode) {
                if (autosaveStatusNode && autosaveStatusNode.dataset.state !== "saving") {
                    autosaveStatusNode.textContent = getLabel(config, "autosaveIdle", "Autosave ready");
                }
                frontendSaveButton.textContent = getLabel(config, "frontendSave", "Save changes");
                frontendPreviewButton.textContent = getLabel(config, "frontendPreview", "Preview");
                frontendPublishButton.textContent = getLabel(config, "frontendPublish", "Publish");
                return;
            }

            let toolbar = shell.querySelector(".editorjs-wp-admin-toolbar");
            if (!toolbar) {
                toolbar = document.createElement("div");
                toolbar.className = "editorjs-wp-admin-toolbar";
                shell.insertBefore(toolbar, shell.firstChild || holder);
            }

            let controls = shell.querySelector(".editorjs-wp-frontend-controls");
            if (!controls) {
                controls = document.createElement("div");
                controls.className = "editorjs-wp-frontend-controls";
                toolbar.appendChild(controls);
            }

            if (!autosaveStatusNode) {
                autosaveStatusNode = document.createElement("div");
                autosaveStatusNode.id = "editorjs-wp-autosave-status";
                autosaveStatusNode.className = "editorjs-wp-autosave-status";
                autosaveStatusNode.dataset.state = "idle";
                autosaveStatusNode.textContent = getLabel(config, "autosaveIdle", "Autosave ready");
                controls.prepend(autosaveStatusNode);
            }

            if (!frontendSaveButton) {
                frontendSaveButton = document.createElement("button");
                frontendSaveButton.type = "button";
                frontendSaveButton.id = "editorjs-wp-frontend-save";
                frontendSaveButton.className = "editorjs-wp-frontend-save-button";
                frontendSaveButton.textContent = getLabel(config, "frontendSave", "Save changes");
                controls.appendChild(frontendSaveButton);
            }

            if (!frontendPreviewButton) {
                frontendPreviewButton = document.createElement("button");
                frontendPreviewButton.type = "button";
                frontendPreviewButton.id = "editorjs-wp-frontend-preview";
                frontendPreviewButton.className = "editorjs-wp-frontend-save-button editorjs-wp-frontend-preview-button";
                frontendPreviewButton.textContent = getLabel(config, "frontendPreview", "Preview");
                controls.appendChild(frontendPreviewButton);
            }

            if (!frontendPublishButton) {
                frontendPublishButton = document.createElement("button");
                frontendPublishButton.type = "button";
                frontendPublishButton.id = "editorjs-wp-frontend-publish";
                frontendPublishButton.className = "editorjs-wp-frontend-save-button editorjs-wp-frontend-publish-button";
                frontendPublishButton.textContent = getLabel(config, "frontendPublish", "Publish");
                controls.appendChild(frontendPublishButton);
            }

            if (!frontendSaveResult) {
                frontendSaveResult = document.createElement("div");
                frontendSaveResult.id = "editorjs-wp-frontend-save-result";
                frontendSaveResult.className = "editorjs-wp-frontend-save-result";
                frontendSaveResult.setAttribute("aria-live", "polite");
                shell.appendChild(frontendSaveResult);
            }
        }

        function setFrontendButtonsBusy(activeButton, inProgressLabel) {
            const buttons = [frontendSaveButton, frontendPreviewButton, frontendPublishButton];
            buttons.forEach(function (button) {
                if (!button) {
                    return;
                }

                button.disabled = true;
                if (button === activeButton && inProgressLabel) {
                    button.textContent = inProgressLabel;
                }
            });
        }

        function restoreFrontendButtonsState() {
            if (frontendSaveButton) {
                frontendSaveButton.disabled = false;
                frontendSaveButton.textContent = getLabel(config, "frontendSave", "Save changes");
            }

            if (frontendPreviewButton) {
                frontendPreviewButton.disabled = false;
                frontendPreviewButton.textContent = getLabel(config, "frontendPreview", "Preview");
            }

            if (frontendPublishButton) {
                frontendPublishButton.disabled = false;
                frontendPublishButton.textContent = getLabel(config, "frontendPublish", "Publish");
            }
        }

        function clearFrontendAutosaveCache() {
            if (
                autosaveInstanceHolder.instance &&
                typeof autosaveInstanceHolder.instance.clearCache === "function"
            ) {
                autosaveInstanceHolder.instance.clearCache();
            }
        }

        function parseMaybeNoisyJson(rawBody) {
            if (typeof rawBody !== "string" || rawBody.trim() === "") {
                return null;
            }

            try {
                return JSON.parse(rawBody);
            } catch (error) {
                const firstBrace = rawBody.indexOf("{");
                if (firstBrace < 0) {
                    return null;
                }

                try {
                    return JSON.parse(rawBody.slice(firstBrace));
                } catch (nestedError) {
                    return null;
                }
            }
        }

        function bindFrontendVisibilityControls() {
            const visibilitySelect = frontendVisibilitySelect || resolveFrontendVisibilitySelect();
            const passwordWrap = document.getElementById("editorjs-wp-post-password-wrap");

            if (!visibilitySelect || !passwordWrap || visibilitySelect.dataset.editorjsBound === "1") {
                return;
            }

            const updateVisibilityUi = function () {
                const selected = String(visibilitySelect.value || "public");
                const isPassword = selected === "password";
                passwordWrap.style.display = isPassword ? "" : "none";
                if (!isPassword) {
                    const input = frontendPasswordInput || resolveFrontendPasswordInput();
                    if (input) {
                        input.value = "";
                    }
                }
            };

            visibilitySelect.addEventListener("change", updateVisibilityUi);
            visibilitySelect.dataset.editorjsBound = "1";
            updateVisibilityUi();
        }

        function bindFrontendFeaturedImageControls() {
            if (!isTrueFlag(config.isFrontendEditor)) {
                return;
            }

            const setButton = document.getElementById("editorjs-wp-featured-image-button");
            const removeButton = document.getElementById("editorjs-wp-featured-image-remove");
            const fileInput = document.getElementById("editorjs-wp-featured-image-file");
            const idInput = frontendFeaturedImageIdInput || resolveFrontendFeaturedImageIdInput();
            const previewNode = document.getElementById("editorjs-wp-featured-image-preview");
            const statusNode = document.getElementById("editorjs-wp-featured-image-status");
            const ajaxNonce = resolveAjaxNonce(config);
            const endpoint = config && config.endpoints ? config.endpoints.uploadImage : "";

            if (!setButton || !fileInput || !idInput || !previewNode) {
                return;
            }

            const setStatus = function (message, isError) {
                if (!statusNode) {
                    return;
                }

                statusNode.textContent = message || "";
                statusNode.classList.toggle("is-error", !!isError);
                statusNode.classList.toggle("is-success", !isError && !!message);
            };

            const applyFeaturedImage = function (attachmentId, imageUrl) {
                const normalizedId = toPositiveInt(attachmentId);
                idInput.value = String(normalizedId || 0);
                if (!config.postMeta || typeof config.postMeta !== "object") {
                    config.postMeta = {};
                }
                config.postMeta.featuredImageId = normalizedId;
                config.postMeta.featuredImageUrl = imageUrl || "";

                previewNode.innerHTML = "";
                if (imageUrl) {
                    const img = document.createElement("img");
                    img.src = imageUrl;
                    img.alt = "";
                    img.loading = "lazy";
                    previewNode.appendChild(img);
                }

                if (removeButton) {
                    removeButton.style.display = normalizedId > 0 ? "" : "none";
                }
            };

            if (setButton.dataset.editorjsBound !== "1") {
                setButton.addEventListener("click", function (event) {
                    event.preventDefault();
                    fileInput.click();
                });
                setButton.dataset.editorjsBound = "1";
            }

            if (removeButton && removeButton.dataset.editorjsBound !== "1") {
                removeButton.addEventListener("click", function (event) {
                    event.preventDefault();
                    applyFeaturedImage(0, "");
                    setStatus("", false);
                });
                removeButton.dataset.editorjsBound = "1";
            }

            if (fileInput.dataset.editorjsBound === "1") {
                return;
            }

            fileInput.addEventListener("change", function () {
                const file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
                if (!file) {
                    return;
                }

                if (!endpoint) {
                    setStatus(getLabel(config, "frontendFeaturedImageUploadError", "Не удалось загрузить изображение."), true);
                    fileInput.value = "";
                    return;
                }

                const formData = new FormData();
                formData.append("image", file);
                if (ajaxNonce !== "") {
                    formData.append("_ajax_nonce", ajaxNonce);
                }

                setStatus(getLabel(config, "frontendFeaturedImageUploading", "Загрузка изображения..."), false);

                fetch(endpoint, {
                    method: "POST",
                    credentials: "same-origin",
                    headers: {
                        Accept: "application/json",
                    },
                    body: formData,
                })
                    .then(function (response) {
                        return response.text().then(function (rawBody) {
                            const payload = parseMaybeNoisyJson(rawBody);
                            const payloadSuccess = !!(
                                payload &&
                                (
                                    isTrueFlag(payload.success)
                                    || isTrueFlag(payload.status)
                                    || (payload.data && payload.data.file)
                                    || payload.file
                                )
                            );

                            if (!response.ok || !payload || !payloadSuccess) {
                                const message = payload && payload.data && payload.data.message
                                    ? payload.data.message
                                    : payload && payload.message
                                        ? payload.message
                                    : getLabel(config, "frontendFeaturedImageUploadError", "Не удалось загрузить изображение.");
                                throw new Error(message);
                            }
                            return payload;
                        });
                    })
                    .then(function (payload) {
                        const data = payload && payload.data && typeof payload.data === "object"
                            ? payload.data
                            : payload;
                        const fileData = data && data.file
                            ? data.file
                            : (payload && payload.file ? payload.file : {});
                        const attachmentId = toPositiveInt(fileData.attachmentId || fileData.id || 0);
                        const imageUrl = typeof fileData.url === "string" ? fileData.url : "";
                        applyFeaturedImage(attachmentId, imageUrl);
                        setStatus("", false);
                    })
                    .catch(function (error) {
                        setStatus(error && error.message ? error.message : getLabel(config, "frontendFeaturedImageUploadError", "Не удалось загрузить изображение."), true);
                    })
                    .finally(function () {
                        fileInput.value = "";
                    });
            });

            fileInput.dataset.editorjsBound = "1";
        }

        function persistFrontendData() {
            const currentPostId = resolvePostId(config);
            if (!isTrueFlag(config.isFrontendEditor) || !currentPostId) {
                return Promise.reject(new Error(getLabel(config, "frontendSaveError", "Unable to save changes.")));
            }
            config.postId = currentPostId;

            return editorInstance.save().then(function (outputData) {
                const normalizedOutputData = normalizePayloadValue(outputData);
                hiddenDataField.value = JSON.stringify(normalizedOutputData);

                return callFrontendSave(config, normalizedOutputData).then(function (responseData) {
                    clearFrontendAutosaveCache();

                    return {
                        outputData: normalizedOutputData,
                        responseData: responseData || {},
                    };
                });
            });
        }

        function openUrlInNewTab(url) {
            if (!url || typeof url !== "string") {
                return false;
            }

            const opened = window.open(url, "_blank", "noopener");
            return !!opened;
        }

        ensureFrontendSaveControls();
        bindFrontendVisibilityControls();
        bindFrontendFeaturedImageControls();

        function saveFrontendPost() {
            setFrontendButtonsBusy(
                frontendSaveButton,
                getLabel(config, "frontendSaveInProgress", "Saving...")
            );
            setFrontendSaveResult("", false);

            return persistFrontendData()
                .then(function () {
                    setFrontendSaveResult(getLabel(config, "frontendSaveSuccess", "Changes saved."), false);
                })
                .catch(function (error) {
                    const message = error && error.message
                        ? error.message
                        : getLabel(config, "frontendSaveError", "Unable to save changes.");
                    setFrontendSaveResult(message, true);
                })
                .finally(function () {
                    restoreFrontendButtonsState();
                });
        }

        function previewFrontendPost() {
            setFrontendButtonsBusy(
                frontendPreviewButton,
                getLabel(config, "frontendPreviewInProgress", "Preparing preview...")
            );
            setFrontendSaveResult("", false);

            return persistFrontendData()
                .then(function (saveResult) {
                    return callFrontendPreview(config, null).then(function (previewData) {
                        const previewUrl =
                            (previewData && previewData.previewUrl)
                            || (previewData && previewData.postUrl)
                            || (saveResult && saveResult.responseData && saveResult.responseData.previewUrl)
                            || (saveResult && saveResult.responseData && saveResult.responseData.postUrl)
                            || "";

                        if (!openUrlInNewTab(previewUrl)) {
                            throw new Error(getLabel(config, "frontendPreviewError", "Unable to open preview."));
                        }

                        setFrontendSaveResult(
                            getLabel(config, "frontendPreviewSuccess", "Preview opened in a new tab."),
                            false
                        );
                    });
                })
                .catch(function (error) {
                    const message = error && error.message
                        ? error.message
                        : getLabel(config, "frontendPreviewError", "Unable to open preview.");
                    setFrontendSaveResult(message, true);
                })
                .finally(function () {
                    restoreFrontendButtonsState();
                });
        }

        function publishFrontendPost() {
            setFrontendButtonsBusy(
                frontendPublishButton,
                getLabel(config, "frontendPublishInProgress", "Publishing...")
            );
            setFrontendSaveResult("", false);

            return persistFrontendData()
                .then(function () {
                    return callFrontendPublish(config, null).then(function () {
                        setFrontendSaveResult(
                            getLabel(config, "frontendPublishSuccess", "Post published."),
                            false
                        );
                    });
                })
                .catch(function (error) {
                    const message = error && error.message
                        ? error.message
                        : getLabel(config, "frontendPublishError", "Unable to publish post.");
                    setFrontendSaveResult(message, true);
                })
                .finally(function () {
                    restoreFrontendButtonsState();
                });
        }

        editorInstance = new window.EditorJS({
            holder: "editorjs-wp-holder",
            data: initialData,
            autofocus: true,
            minHeight: 200,
            readOnly: false,
            tools: tools,
            i18n: config.i18n || {},
            onReady: function () {
                holder.classList.add("is-ready");
                installSlashShortcut(holder);
                patchKnownLocaleGlitches(document.body);
                enforceTableCellEditability(holder);
                enforceEditorInputEditability(holder);
                markQuoteBlockContent(holder);

                if (typeof MutationObserver === "function") {
                    const localeObserver = new MutationObserver(function () {
                        patchKnownLocaleGlitches(document.body);
                        enforceTableCellEditability(holder);
                        enforceEditorInputEditability(holder);
                        markQuoteBlockContent(holder);
                    });
                    localeObserver.observe(document.body, {
                        childList: true,
                        subtree: true,
                        characterData: true,
                    });
                }

                if (typeof window.DragDrop === "function") {
                    new window.DragDrop(editorInstance);
                }

                if (typeof window.EditorJSWPAutosave === "function") {
                    autosaveInstanceHolder.instance = new window.EditorJSWPAutosave(
                        editorInstance,
                        config,
                        hiddenDataField,
                        autosaveStatusNode
                    );
                    autosaveInstanceHolder.instance.start();
                }

                if (typeof window.EditorJSWPIntegrationsBootstrap === "function") {
                    window.EditorJSWPIntegrationsBootstrap(editorInstance, config, {
                        holder: holder,
                        hiddenField: hiddenDataField,
                        autosave: autosaveInstanceHolder.instance,
                    });
                }

                editorInstance.save()
                    .then(function (outputData) {
                        hiddenDataField.value = JSON.stringify(normalizePayloadValue(outputData));
                    })
                    .catch(function () {
                        return undefined;
                    });
            },
            onChange: function () {
                return editorInstance.save().then(function (outputData) {
                    hiddenDataField.value = JSON.stringify(normalizePayloadValue(outputData));
                    enforceTableCellEditability(holder);
                    enforceEditorInputEditability(holder);
                    markQuoteBlockContent(holder);
                }).catch(function () {
                    return undefined;
                });
            },
        });

        if (isTrueFlag(config.isFrontendEditor) && frontendSaveButton) {
            frontendSaveButton.addEventListener("click", function (event) {
                event.preventDefault();
                saveFrontendPost();
            });
        }

        if (isTrueFlag(config.isFrontendEditor) && frontendPreviewButton) {
            frontendPreviewButton.addEventListener("click", function (event) {
                event.preventDefault();
                previewFrontendPost();
            });
        }

        if (isTrueFlag(config.isFrontendEditor) && frontendPublishButton) {
            frontendPublishButton.addEventListener("click", function (event) {
                event.preventDefault();
                publishFrontendPost();
            });
        }

        const postForm = document.getElementById("post");
        if (postForm) {
            if (!isTrueFlag(config.isFrontendEditor)) {
                postForm.addEventListener("submit", function () {
                    if (
                        autosaveInstanceHolder.instance &&
                        typeof autosaveInstanceHolder.instance.prepareForSubmit === "function"
                    ) {
                        autosaveInstanceHolder.instance.prepareForSubmit({
                            clearCache: isTrueFlag(config.isNewPostScreen),
                        });
                    }

                    editorInstance.save()
                        .then(function (outputData) {
                            hiddenDataField.value = JSON.stringify(normalizePayloadValue(outputData));
                        })
                        .catch(function () {
                            return undefined;
                        });
                });

                return;
            }

            postForm.addEventListener("submit", function (event) {
                if (isProgrammaticSubmit) {
                    return;
                }

                event.preventDefault();

                editorInstance.save()
                    .then(function (outputData) {
                        hiddenDataField.value = JSON.stringify(normalizePayloadValue(outputData));
                        if (autosaveInstanceHolder.instance) {
                            return autosaveInstanceHolder.instance.persist("submit");
                        }
                        return undefined;
                    })
                    .catch(function () {
                        return undefined;
                    })
                    .finally(function () {
                        if (
                            autosaveInstanceHolder.instance &&
                            typeof autosaveInstanceHolder.instance.prepareForSubmit === "function"
                        ) {
                            autosaveInstanceHolder.instance.prepareForSubmit({
                                clearCache: isTrueFlag(config.isNewPostScreen),
                            });
                        } else if (isTrueFlag(config.isNewPostScreen) && window.localStorage) {
                            try {
                                window.localStorage.removeItem(getCacheKey(config));
                            } catch (error) {
                                // no-op
                            }
                        }

                        isProgrammaticSubmit = true;
                        HTMLFormElement.prototype.submit.call(postForm);
                });
            });
        }
        };

        const readyPromise = window.EditorJSWPReadyPromise && typeof window.EditorJSWPReadyPromise.then === "function"
            ? window.EditorJSWPReadyPromise
            : Promise.resolve();

        readyPromise
            .then(bootEditor)
            .catch(function () {
                bootEditor();
            });
    });
})(window, document);

