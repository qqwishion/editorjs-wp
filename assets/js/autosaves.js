(function (window, document) {
    "use strict";

    function isTrueFlag(value) {
        return value === true || value === 1 || value === "1" || value === "true";
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

        const params = new URLSearchParams(window.location && window.location.search ? window.location.search : "");
        const queryKeys = ["id", "post", "post_id"];
        for (let index = 0; index < queryKeys.length; index += 1) {
            const fromQuery = toPositiveInt(params.get(queryKeys[index]));
            if (fromQuery > 0) {
                return fromQuery;
            }
        }

        return 0;
    }

    function getCacheKey(config) {
        const prefix = config && config.cacheKeyPrefix ? config.cacheKeyPrefix : "editorjs_wp_post_";
        if (config && isTrueFlag(config.isNewPostScreen)) {
            return prefix + "new";
        }
        const postId = resolvePostId(config);
        return prefix + (postId > 0 ? postId : "new");
    }

    function getLabel(config, key, fallback) {
        if (config && config.labels && typeof config.labels[key] === "string" && config.labels[key].trim() !== "") {
            return config.labels[key];
        }
        return fallback;
    }

    function formatTimeStamp(rawValue) {
        if (!rawValue) {
            return "";
        }

        const date = new Date(rawValue);
        if (!isNaN(date.getTime())) {
            return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        }

        const normalized = String(rawValue).replace(" ", "T");
        const fallbackDate = new Date(normalized);
        if (!isNaN(fallbackDate.getTime())) {
            return fallbackDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        }

        return "";
    }

    class EditorJSWPAutosave {
        constructor(editor, config, hiddenField, statusNode) {
            this.editor = editor;
            this.config = config || {};
            this.hiddenField = hiddenField || null;
            this.statusNode = statusNode || null;
            this.intervalId = null;
            this.pending = false;
            this.cacheKey = getCacheKey(this.config);
            this.disabled = false;
            this.beforeUnloadHandler = null;
        }

        start() {
            if (!this.editor || this.disabled) {
                return;
            }

            this.setStatus("idle", getLabel(this.config, "autosaveIdle", "Автосохранение готово"));
            this.restoreFromCache();

            const interval = parseInt(this.config.autosaveInterval || 15000, 10);
            this.intervalId = window.setInterval(() => {
                this.persist("interval");
            }, interval);

            this.beforeUnloadHandler = () => {
                this.flushBeforeUnload();
            };
            window.addEventListener("beforeunload", this.beforeUnloadHandler);
        }

        stop() {
            if (this.intervalId) {
                window.clearInterval(this.intervalId);
                this.intervalId = null;
            }

            if (this.beforeUnloadHandler) {
                window.removeEventListener("beforeunload", this.beforeUnloadHandler);
                this.beforeUnloadHandler = null;
            }
        }

        clearCache() {
            if (!window.localStorage) {
                return;
            }

            try {
                window.localStorage.removeItem(this.cacheKey);
            } catch (error) {
                // no-op
            }
        }

        prepareForSubmit(options) {
            this.disabled = true;
            this.stop();

            if (options && options.clearCache) {
                this.clearCache();
            }
        }

        persist(reason) {
            if (this.pending || this.disabled) {
                return Promise.resolve();
            }

            this.pending = true;
            this.setStatus("saving", getLabel(this.config, "autosaveSaving", "Сохраняю черновик..."));

            return this.editor
                .save()
                .then((data) => {
                    const meta = this.collectMetaState();
                    this.updateHiddenField(data);
                    this.writeCache(data, meta);
                    return this.sendAutosave(data, reason || "interval").then((result) => {
                        if (result && result.localOnly) {
                            this.setStatus("local", getLabel(this.config, "autosaveLocal", "Сохранено локально (новый пост)"));
                            return;
                        }

                        const fallbackNow = new Date();
                        const savedValue = result && result.savedAt ? result.savedAt : fallbackNow.toISOString();
                        const formatted = formatTimeStamp(savedValue);
                        const template = getLabel(this.config, "autosaveSaved", "Сохранено в %s");
                        const rendered = template.indexOf("%s") !== -1
                            ? template.replace("%s", formatted || "now")
                            : template + " " + (formatted || "");
                        this.setStatus("saved", rendered.trim());
                    });
                })
                .catch((error) => {
                    const fallback = getLabel(this.config, "autosaveError", "Ошибка автосохранения");
                    this.setStatus("error", error && error.message ? error.message : fallback);
                })
                .finally(() => {
                    this.pending = false;
                });
        }

        flushBeforeUnload() {
            if (!this.editor || this.disabled) {
                return;
            }

            this.editor
                .save()
                .then((data) => {
                    const meta = this.collectMetaState();
                    this.updateHiddenField(data);
                    this.writeCache(data, meta);
                    this.sendBeacon(data, meta);
                })
                .catch(() => undefined);
        }

        updateHiddenField(data) {
            if (!this.hiddenField) {
                return;
            }
            this.hiddenField.value = JSON.stringify(data);
        }

        collectMetaState() {
            const titleInput = document.getElementById("editorjs-wp-post-title")
                || document.getElementById("title")
                || document.querySelector("input[name='post_title']");
            const categorySelect = document.getElementById("editorjs-wp-post-categories");
            const formatSelect = document.getElementById("editorjs-wp-post-format");
            const excerptInput = document.getElementById("editorjs-wp-post-excerpt")
                || document.querySelector("textarea[name='excerpt']");
            const tagsInput = document.getElementById("editorjs-wp-post-tags")
                || document.querySelector("input[name='tags_input']");
            const visibilitySelect = document.getElementById("editorjs-wp-post-visibility");
            const passwordInput = document.getElementById("editorjs-wp-post-password");
            const featuredImageIdInput = document.getElementById("editorjs-wp-featured-image-id");

            const postTitle = titleInput && typeof titleInput.value === "string"
                ? titleInput.value.trim()
                : (typeof this.config.postTitle === "string" ? this.config.postTitle.trim() : "");

            const postCategoryIds = categorySelect && categorySelect.options
                ? Array.from(categorySelect.options)
                    .filter((option) => option.selected)
                    .map((option) => parseInt(option.value, 10))
                    .filter((value) => !isNaN(value) && value > 0)
                : (this.config.postMeta && Array.isArray(this.config.postMeta.categoryIds)
                    ? this.config.postMeta.categoryIds
                        .map((value) => parseInt(value, 10))
                        .filter((value) => !isNaN(value) && value > 0)
                    : []);

            const postFormat = formatSelect && typeof formatSelect.value === "string" && formatSelect.value
                ? formatSelect.value
                : (this.config.postMeta && typeof this.config.postMeta.format === "string" && this.config.postMeta.format
                    ? this.config.postMeta.format
                    : "standard");

            const postExcerpt = excerptInput && typeof excerptInput.value === "string"
                ? excerptInput.value
                : (this.config.postMeta && typeof this.config.postMeta.excerpt === "string"
                    ? this.config.postMeta.excerpt
                    : "");

            const postTags = tagsInput && typeof tagsInput.value === "string"
                ? tagsInput.value
                : (this.config.postMeta && typeof this.config.postMeta.tags === "string"
                    ? this.config.postMeta.tags
                    : "");

            const postVisibility = visibilitySelect && typeof visibilitySelect.value === "string" && visibilitySelect.value
                ? visibilitySelect.value
                : (this.config.postMeta && typeof this.config.postMeta.visibility === "string" && this.config.postMeta.visibility
                    ? this.config.postMeta.visibility
                    : "public");

            const postPassword = passwordInput && typeof passwordInput.value === "string"
                ? passwordInput.value
                : (this.config.postMeta && typeof this.config.postMeta.password === "string"
                    ? this.config.postMeta.password
                    : "");

            const postFeaturedImageId = featuredImageIdInput
                ? toPositiveInt(featuredImageIdInput.value)
                : (this.config.postMeta ? toPositiveInt(this.config.postMeta.featuredImageId || 0) : 0);

            return {
                postTitle: postTitle,
                postCategoryIds: postCategoryIds,
                postFormat: postFormat || "standard",
                postExcerpt: postExcerpt,
                postTags: postTags,
                postVisibility: postVisibility || "public",
                postPassword: postPassword,
                postFeaturedImageId: postFeaturedImageId,
            };
        }

        applyMetaState(meta) {
            if (!meta || typeof meta !== "object") {
                return;
            }

            const titleInput = document.getElementById("editorjs-wp-post-title")
                || document.getElementById("title")
                || document.querySelector("input[name='post_title']");
            if (titleInput && typeof meta.postTitle === "string") {
                titleInput.value = meta.postTitle;
            }

            const categorySelect = document.getElementById("editorjs-wp-post-categories");
            if (categorySelect && categorySelect.options && Array.isArray(meta.postCategoryIds)) {
                const selectedIds = meta.postCategoryIds
                    .map((value) => parseInt(value, 10))
                    .filter((value) => !isNaN(value) && value > 0);

                Array.from(categorySelect.options).forEach((option) => {
                    const optionValue = parseInt(option.value, 10);
                    option.selected = !isNaN(optionValue) && selectedIds.indexOf(optionValue) !== -1;
                });
            }

            const formatSelect = document.getElementById("editorjs-wp-post-format");
            if (formatSelect && typeof meta.postFormat === "string") {
                formatSelect.value = meta.postFormat || "standard";
            }

            const excerptInput = document.getElementById("editorjs-wp-post-excerpt")
                || document.querySelector("textarea[name='excerpt']");
            if (excerptInput && typeof meta.postExcerpt === "string") {
                excerptInput.value = meta.postExcerpt;
            }

            const tagsInput = document.getElementById("editorjs-wp-post-tags")
                || document.querySelector("input[name='tags_input']");
            if (tagsInput && typeof meta.postTags === "string") {
                tagsInput.value = meta.postTags;
            }

            const visibilitySelect = document.getElementById("editorjs-wp-post-visibility");
            if (visibilitySelect && typeof meta.postVisibility === "string") {
                visibilitySelect.value = meta.postVisibility || "public";
                visibilitySelect.dispatchEvent(new Event("change", { bubbles: true }));
            }

            const passwordInput = document.getElementById("editorjs-wp-post-password");
            if (passwordInput && typeof meta.postPassword === "string") {
                passwordInput.value = meta.postPassword;
            }

            const featuredImageIdInput = document.getElementById("editorjs-wp-featured-image-id");
            if (featuredImageIdInput && typeof meta.postFeaturedImageId !== "undefined") {
                featuredImageIdInput.value = String(toPositiveInt(meta.postFeaturedImageId));
            }

            if (typeof meta.postTitle === "string") {
                this.config.postTitle = meta.postTitle;
            }

            if (!this.config.postMeta || typeof this.config.postMeta !== "object") {
                this.config.postMeta = {};
            }
            if (Array.isArray(meta.postCategoryIds)) {
                this.config.postMeta.categoryIds = meta.postCategoryIds;
            }
            if (typeof meta.postFormat === "string") {
                this.config.postMeta.format = meta.postFormat || "standard";
            }
            if (typeof meta.postExcerpt === "string") {
                this.config.postMeta.excerpt = meta.postExcerpt;
            }
            if (typeof meta.postTags === "string") {
                this.config.postMeta.tags = meta.postTags;
            }
            if (typeof meta.postVisibility === "string") {
                this.config.postMeta.visibility = meta.postVisibility || "public";
            }
            if (typeof meta.postPassword === "string") {
                this.config.postMeta.password = meta.postPassword;
            }
            if (typeof meta.postFeaturedImageId !== "undefined") {
                this.config.postMeta.featuredImageId = toPositiveInt(meta.postFeaturedImageId);
            }
        }

        appendMetaToFormData(formData, meta) {
            const data = meta || this.collectMetaState();
            formData.append("postTitle", data.postTitle || "");
            formData.append("postCategoryIds", JSON.stringify(data.postCategoryIds || []));
            formData.append("postFormat", data.postFormat || "standard");
            formData.append("postExcerpt", data.postExcerpt || "");
            formData.append("postTags", data.postTags || "");
            formData.append("postVisibility", data.postVisibility || "public");
            formData.append("postPassword", data.postPassword || "");
            formData.append("postFeaturedImageId", String(toPositiveInt(data.postFeaturedImageId)));
        }

        getAjaxNonce() {
            if (isTrueFlag(this.config.isFrontendEditor)) {
                return "";
            }

            return (typeof this.config.nonce === "string") ? this.config.nonce : "";
        }

        restoreFromCache() {
            if (!window.localStorage || !this.hiddenField) {
                return;
            }

            if (this.hiddenField.value && this.hiddenField.value.trim() !== "") {
                return;
            }

            const raw = window.localStorage.getItem(this.cacheKey);
            if (!raw) {
                return;
            }

            try {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.data) {
                    this.hiddenField.value = JSON.stringify(parsed.data);
                }
                if (parsed && parsed.meta) {
                    this.applyMetaState(parsed.meta);
                }
            } catch (error) {
                window.localStorage.removeItem(this.cacheKey);
            }
        }

        writeCache(data, meta) {
            if (!window.localStorage) {
                return;
            }

            try {
                window.localStorage.setItem(
                    this.cacheKey,
                    JSON.stringify({
                        savedAt: Date.now(),
                        data: data,
                        meta: meta || this.collectMetaState(),
                    })
                );
            } catch (error) {
                // no-op
            }
        }

        sendAutosave(data, reason) {
            if (this.disabled) {
                return Promise.resolve({ localOnly: true });
            }

            if (isTrueFlag(this.config.isNewPostScreen)) {
                return Promise.resolve({ localOnly: true });
            }

            const currentPostId = resolvePostId(this.config);
            if (!currentPostId) {
                return Promise.resolve({ localOnly: true });
            }
            this.config.postId = currentPostId;

            const formData = new FormData();
            const ajaxNonce = this.getAjaxNonce();
            formData.append("action", "editorjs_wp_autosave");
            if (ajaxNonce !== "") {
                formData.append("_ajax_nonce", ajaxNonce);
            }
            formData.append("postId", String(currentPostId));
            formData.append("editorData", JSON.stringify(data));
            formData.append("reason", reason);
            this.appendMetaToFormData(formData);

            return fetch(this.config.endpoints.autosave, {
                method: "POST",
                credentials: "same-origin",
                body: formData,
            }).then((response) => {
                return response.json().then((payload) => {
                    if (!response.ok || !payload || payload.success !== true) {
                        const message = payload && payload.data && payload.data.message
                            ? payload.data.message
                            : getLabel(this.config, "autosaveError", "Ошибка автосохранения");
                        throw new Error(message);
                    }

                    return payload.data || {};
                });
            });
        }

        sendBeacon(data, meta) {
            const currentPostId = resolvePostId(this.config);
            if (!currentPostId || typeof navigator.sendBeacon !== "function") {
                return;
            }
            this.config.postId = currentPostId;

            const formData = new FormData();
            const ajaxNonce = this.getAjaxNonce();
            formData.append("action", "editorjs_wp_autosave");
            if (ajaxNonce !== "") {
                formData.append("_ajax_nonce", ajaxNonce);
            }
            formData.append("postId", String(currentPostId));
            formData.append("editorData", JSON.stringify(data));
            formData.append("reason", "beforeunload");
            this.appendMetaToFormData(formData, meta);

            navigator.sendBeacon(this.config.endpoints.autosave, formData);
        }

        setStatus(state, text) {
            if (!this.statusNode) {
                return;
            }

            this.statusNode.dataset.state = state || "idle";
            this.statusNode.textContent = text || "";
        }
    }

    window.EditorJSWPAutosave = EditorJSWPAutosave;
})(window, document);
