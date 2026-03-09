(function (window) {
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

    function resolveAjaxNonce(config) {
        if (!config || isTrueFlag(config.isFrontendEditor)) {
            return "";
        }

        return (typeof config.nonce === "string") ? config.nonce : "";
    }

    function getVideoToolTitle() {
        const config = window.EditorJSWPConfig || {};
        return getLabel(config, "videoToolTitle", "Р’РёРґРµРѕ");
    }

    function unwrapAjaxResponse(payload, defaultMessage) {
        if (!payload) {
            throw new Error(defaultMessage);
        }

        const isSuccess = (
            payload.success === 1
            || payload.success === true
            || payload.success === "1"
            || !!payload.file
            || !!(payload.data && payload.data.file)
        );

        if (isSuccess) {
            if (!payload.file && payload.data && payload.data.file) {
                payload.file = payload.data.file;
            }
            return payload;
        }

        const payloadMessage = (
            payload.data && payload.data.message
                ? payload.data.message
                : (payload.message || defaultMessage)
        );

        throw new Error(payloadMessage);
    }

    function parsePossiblyNoisyJson(raw) {
        if (typeof raw !== "string" || raw.trim() === "") {
            return null;
        }

        try {
            return JSON.parse(raw);
        } catch (error) {
            const firstBrace = raw.indexOf("{");
            if (firstBrace < 0) {
                return null;
            }

            try {
                return JSON.parse(raw.slice(firstBrace));
            } catch (nestedError) {
                return null;
            }
        }
    }

    function uploadFile(url, fieldName, file, nonce, fallbackMessage) {
        const formData = new FormData();
        formData.append(fieldName, file);
        if (typeof nonce === "string" && nonce !== "") {
            formData.append("_ajax_nonce", nonce);
        }

        return fetch(url, {
            method: "POST",
            credentials: "same-origin",
            headers: {
                Accept: "application/json",
            },
            body: formData,
        })
            .then(function (response) {
                return response.text().then(function (rawBody) {
                    const payload = parsePossiblyNoisyJson(rawBody);
                    if (!response.ok) {
                        const message =
                            payload &&
                            payload.data &&
                            payload.data.message
                                ? payload.data.message
                                : fallbackMessage;
                        throw new Error(message);
                    }
                    return payload;
                });
            })
            .then(function (payload) {
                return unwrapAjaxResponse(payload, fallbackMessage);
            });
    }

    function uploadBlob(url, fieldName, blob, filename, nonce, fallbackMessage) {
        const formData = new FormData();
        formData.append(fieldName, blob, filename || "upload.bin");
        if (typeof nonce === "string" && nonce !== "") {
            formData.append("_ajax_nonce", nonce);
        }

        return fetch(url, {
            method: "POST",
            credentials: "same-origin",
            headers: {
                Accept: "application/json",
            },
            body: formData,
        })
            .then(function (response) {
                return response.text().then(function (rawBody) {
                    const payload = parsePossiblyNoisyJson(rawBody);
                    if (!response.ok) {
                        const message =
                            payload &&
                            payload.data &&
                            payload.data.message
                                ? payload.data.message
                                : fallbackMessage;
                        throw new Error(message);
                    }
                    return payload;
                });
            })
            .then(function (payload) {
                return unwrapAjaxResponse(payload, fallbackMessage);
            });
    }

    class EditorJSWPVideoTool {
        static get toolbox() {
            return {
                title: getVideoToolTitle(),
                icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><!--!Font Awesome Free v7.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path opacity=".4" d="M64 192L64 448C64 483.3 92.7 512 128 512L384 512C419.3 512 448 483.3 448 448L448 192C448 156.7 419.3 128 384 128L128 128C92.7 128 64 156.7 64 192z"/><path d="M448 252.8L448 387.2L537.5 458.8C541.7 462.2 546.9 464 552.3 464C565.4 464 576 453.4 576 440.3L576 199.7C576 186.6 565.4 176 552.3 176C546.9 176 541.7 177.8 537.5 181.2L448 252.8z"/></svg>',
            };
        }

        constructor(options) {
            this.api = options.api;
            this.config = options.config || {};
            this.labels = this.config.labels || {};
            this.data = options.data || {};

            this.wrapper = null;
            this.fileInput = null;
            this.preview = null;
            this.captionInput = null;
            this.status = null;
        }

        render() {
            this.wrapper = document.createElement("div");
            this.wrapper.className = "editorjs-wp-video-tool";

            const controls = document.createElement("div");
            controls.className = "editorjs-wp-video-controls";

            const button = document.createElement("button");
            button.type = "button";
            button.className = "button button-secondary";
            button.textContent = this.labels.videoUpload || "Р—Р°РіСЂСѓР·РёС‚СЊ РІРёРґРµРѕ";
            button.addEventListener("click", this.onUploadButtonClick.bind(this));

            this.fileInput = document.createElement("input");
            this.fileInput.type = "file";
            this.fileInput.accept = "video/mp4,video/webm,video/ogg,video/quicktime";
            this.fileInput.className = "editorjs-wp-hidden";
            this.fileInput.addEventListener("change", this.onFileChange.bind(this));

            this.status = document.createElement("span");
            this.status.className = "editorjs-wp-video-status";

            controls.appendChild(button);
            controls.appendChild(this.fileInput);
            controls.appendChild(this.status);

            this.preview = document.createElement("div");
            this.preview.className = "editorjs-wp-video-preview";

            this.captionInput = document.createElement("input");
            this.captionInput.type = "text";
            this.captionInput.className = "editorjs-wp-video-caption";
            this.captionInput.placeholder = this.labels.videoCaption || "РџРѕРґРїРёСЃСЊ Рє РІРёРґРµРѕ";
            this.captionInput.value = this.data.caption || "";

            this.wrapper.appendChild(controls);
            this.wrapper.appendChild(this.preview);
            this.wrapper.appendChild(this.captionInput);

            if (this.data.url) {
                this.renderPreview();
            }

            return this.wrapper;
        }

        save() {
            return {
                url: this.data.url || "",
                caption: this.captionInput ? this.captionInput.value : "",
                width: this.data.width || 0,
                height: this.data.height || 0,
                attachmentId: this.data.attachmentId || 0,
                poster: this.data.poster || "",
            };
        }

        validate(savedData) {
            return !!(savedData && savedData.url);
        }

        onUploadButtonClick() {
            if (this.fileInput) {
                this.fileInput.click();
            }
        }

        onFileChange(event) {
            const file = event && event.target && event.target.files ? event.target.files[0] : null;
            if (!file) {
                return;
            }

            this.setStatus(this.labels.videoUploading || "Р—Р°РіСЂСѓР·РєР°...");
            const previewSecond = parseInt(this.config.previewSecond || 5, 10);
            const posterFromFilePromise = this.capturePosterFromFile(file, previewSecond).catch(() => "");

            uploadFile(
                this.config.uploadUrl,
                "video",
                file,
                this.config.nonce,
                this.labels.videoUploadFailed || "РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РІРёРґРµРѕ."
            )
                .then((response) => {
                    const uploaded = response.file || {};
                    const width = parseInt(uploaded.width || 0, 10);
                    const height = parseInt(uploaded.height || 0, 10);

                    this.data = {
                        url: uploaded.url || "",
                        caption: this.captionInput ? this.captionInput.value : "",
                        width: width,
                        height: height,
                        attachmentId: parseInt(uploaded.attachmentId || 0, 10) || 0,
                        poster: "",
                    };

                    this.renderPreview();
                    this.setStatus(this.labels.videoPreviewGenerating || "Р“РѕС‚РѕРІР»СЋ Р·Р°СЃС‚Р°РІРєСѓ (5-СЏ СЃРµРєСѓРЅРґР°)...");

                    return posterFromFilePromise
                        .then((posterDataUrl) => {
                            if (posterDataUrl) {
                                return posterDataUrl;
                            }
                            return this.capturePosterAtSecond(this.data.url, previewSecond);
                        })
                        .then((posterDataUrl) => {
                            if (posterDataUrl) {
                                return this.persistPosterData(posterDataUrl).then((storedPoster) => {
                                    this.data.poster = storedPoster || posterDataUrl;
                                    this.renderPreview();
                                    this.setStatus(this.labels.videoPreviewReady || "Р—Р°СЃС‚Р°РІРєР° РіРѕС‚РѕРІР°");
                                });
                            }

                            this.setStatus(
                                this.labels.videoPreviewFailed ||
                                    "РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ Р·Р°СЃС‚Р°РІРєСѓ, Р±СѓРґРµС‚ СЃС‚Р°РЅРґР°СЂС‚РЅС‹Р№ РєР°РґСЂ."
                            );
                        });
                })
                .catch((error) => {
                    this.setStatus(error.message || this.labels.videoUploadFailed || "РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РІРёРґРµРѕ.");
                })
                .finally(() => {
                    if (this.fileInput) {
                        this.fileInput.value = "";
                    }
                });
        }

        renderPreview() {
            if (!this.preview || !this.data.url) {
                return;
            }

            this.preview.innerHTML = "";
            const video = document.createElement("video");
            video.controls = true;
            video.preload = this.data.poster ? "none" : "metadata";
            video.src = this.data.url;
            video.className = "editorjs-wp-video-element";
            if (this.data.poster) {
                video.poster = this.data.poster;
            }

            this.preview.appendChild(video);
        }

        capturePosterAtSecond(url, second) {
            return this.capturePosterAtSource(url, second);
        }

        capturePosterFromFile(file, second) {
            if (!file) {
                return Promise.resolve("");
            }

            const captureFromDataUrlFallback = () => {
                if (typeof FileReader !== "function") {
                    return Promise.resolve("");
                }

                return this.readFileAsDataUrl(file).then((fileDataUrl) => {
                    if (!fileDataUrl) {
                        return "";
                    }
                    return this.capturePosterAtSource(fileDataUrl, second);
                });
            };

            if (typeof URL.createObjectURL !== "function") {
                return captureFromDataUrlFallback();
            }

            const objectUrl = URL.createObjectURL(file);
            return this.capturePosterAtSource(objectUrl, second)
                .finally(() => {
                    URL.revokeObjectURL(objectUrl);
                })
                .then((posterDataUrl) => {
                    if (posterDataUrl) {
                        return posterDataUrl;
                    }
                    return captureFromDataUrlFallback();
                });
        }

        readFileAsDataUrl(file) {
            return new Promise((resolve) => {
                try {
                    const reader = new FileReader();
                    reader.onload = () => {
                        resolve(typeof reader.result === "string" ? reader.result : "");
                    };
                    reader.onerror = () => {
                        resolve("");
                    };
                    reader.readAsDataURL(file);
                } catch (error) {
                    resolve("");
                }
            });
        }

        persistPosterData(posterDataUrl) {
            if (!posterDataUrl || typeof posterDataUrl !== "string") {
                return Promise.resolve("");
            }

            if (!this.config.posterUploadUrl) {
                return Promise.resolve(posterDataUrl);
            }

            const blob = this.dataUrlToBlob(posterDataUrl);
            if (!blob) {
                return Promise.resolve(posterDataUrl);
            }

            const uploadErrorMessage =
                this.labels.videoPreviewFailed ||
                "РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ Р·Р°СЃС‚Р°РІРєСѓ, Р±СѓРґРµС‚ СЃС‚Р°РЅРґР°СЂС‚РЅС‹Р№ РєР°РґСЂ.";

            return uploadBlob(
                this.config.posterUploadUrl,
                "image",
                blob,
                "video-poster.jpg",
                this.config.nonce,
                uploadErrorMessage
            )
                .then((response) => {
                    const file = response && response.file ? response.file : {};
                    if (file.url) {
                        return file.url;
                    }
                    return posterDataUrl;
                })
                .catch(() => posterDataUrl);
        }

        dataUrlToBlob(dataUrl) {
            if (typeof dataUrl !== "string") {
                return null;
            }

            const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
            if (!match) {
                return null;
            }

            try {
                const mimeType = match[1] || "image/jpeg";
                const binary = window.atob(match[2]);
                const bytes = new Uint8Array(binary.length);
                for (let index = 0; index < binary.length; index += 1) {
                    bytes[index] = binary.charCodeAt(index);
                }
                return new Blob([bytes], { type: mimeType });
            } catch (error) {
                return null;
            }
        }

        capturePosterAtSource(source, second) {
            return new Promise((resolve) => {
                const probe = document.createElement("video");
                let finalized = false;
                const maxWidth = parseInt(this.config.maxWidth || 800, 10);
                const maxHeight = parseInt(this.config.maxHeight || 600, 10);
                const fallbackTimes = [second || 5, 3, 1, 0.2];
                let attemptIndex = 0;
                let attemptToken = 0;

                const finish = (poster) => {
                    if (finalized) {
                        return;
                    }
                    finalized = true;
                    try {
                        probe.pause();
                        probe.removeAttribute("src");
                        probe.load();
                    } catch (error) {
                        // no-op
                    }
                    resolve(poster || "");
                };

                const getScaledSize = () => {
                    const sourceWidth = probe.videoWidth || maxWidth;
                    const sourceHeight = probe.videoHeight || maxHeight;

                    if (!sourceWidth || !sourceHeight) {
                        return { width: maxWidth, height: maxHeight };
                    }

                    const ratio = Math.min(
                        maxWidth / sourceWidth,
                        maxHeight / sourceHeight,
                        1
                    );

                    return {
                        width: Math.max(1, Math.round(sourceWidth * ratio)),
                        height: Math.max(1, Math.round(sourceHeight * ratio)),
                    };
                };

                const drawFrame = () => {
                    try {
                        const size = getScaledSize();
                        const canvas = document.createElement("canvas");
                        canvas.width = size.width;
                        canvas.height = size.height;

                        const context = canvas.getContext("2d");
                        if (!context) {
                            return "";
                        }

                        context.drawImage(probe, 0, 0, size.width, size.height);
                        const posterDataUrl = canvas.toDataURL("image/jpeg", 0.8);
                        if (!posterDataUrl || posterDataUrl.length < 64) {
                            return "";
                        }
                        return posterDataUrl;
                    } catch (error) {
                        return "";
                    }
                };

                const seekAndCaptureNext = () => {
                    if (attemptIndex >= fallbackTimes.length) {
                        finish("");
                        return;
                    }

                    const rawTarget = fallbackTimes[attemptIndex];
                    attemptIndex += 1;
                    attemptToken += 1;
                    const currentToken = attemptToken;

                    if (!isFinite(rawTarget)) {
                        seekAndCaptureNext();
                        return;
                    }

                    const target = Math.max(
                        0,
                        Math.min(rawTarget, Math.max(probe.duration - 0.05, 0))
                    );

                    const timeoutId = window.setTimeout(() => {
                        if (currentToken !== attemptToken) {
                            return;
                        }
                        seekAndCaptureNext();
                    }, 1800);

                    probe.addEventListener("seeked", () => {
                        if (currentToken !== attemptToken) {
                            return;
                        }

                        window.clearTimeout(timeoutId);
                        // Give decoder a short moment to paint target frame.
                        window.setTimeout(() => {
                            if (currentToken !== attemptToken) {
                                return;
                            }

                            const posterDataUrl = drawFrame();
                            if (posterDataUrl) {
                                finish(posterDataUrl);
                                return;
                            }
                            seekAndCaptureNext();
                        }, 80);
                    }, { once: true });

                    try {
                        probe.currentTime = target;
                    } catch (error) {
                        window.clearTimeout(timeoutId);
                        seekAndCaptureNext();
                    }
                };

                probe.preload = "auto";
                probe.muted = true;
                probe.playsInline = true;
                if (typeof source === "string" && source.indexOf("blob:") !== 0) {
                    probe.crossOrigin = "anonymous";
                }

                probe.addEventListener("error", () => {
                    finish("");
                }, { once: true });

                probe.addEventListener("loadedmetadata", () => {
                    if (!probe.videoWidth || !probe.videoHeight || !isFinite(probe.duration)) {
                        finish("");
                        return;
                    }
                    seekAndCaptureNext();
                }, { once: true });

                probe.src = source;
            });
        }

        setStatus(message) {
            if (this.status) {
                this.status.textContent = message || "";
            }
        }
    }

    class EditorJSWPButtonTool {
        static get toolbox() {
            const config = window.EditorJSWPConfig || {};
            return {
                title: getLabel(config, "buttonToolTitle", "Кнопка"),
                icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M7 7h10a4 4 0 1 1 0 8h-1.6a1 1 0 1 1 0-2H17a2 2 0 1 0 0-4H7a2 2 0 1 0 0 4h1.6a1 1 0 1 1 0 2H7a4 4 0 1 1 0-8Z"/><path fill="currentColor" d="M10.2 11a1 1 0 0 1 1-1h1.6a1 1 0 1 1 0 2h-1.6a1 1 0 0 1-1-1Zm2.8 3a1 1 0 0 0-1-1h-1.6a1 1 0 1 0 0 2H12a1 1 0 0 0 1-1Z"/></svg>',
            };
        }

        static get isReadOnlySupported() {
            return true;
        }

        static get sanitize() {
            return {
                text: false,
                link: false,
            };
        }

        constructor(options) {
            this.api = options.api;
            this.config = options.config || {};
            this.labels = this.config.labels || {};
            this.readOnly = !!options.readOnly;

            const initial = options.data && typeof options.data === "object" ? options.data : {};
            this.data = {
                text: String(initial.text || initial.label || "").trim(),
                link: String(initial.link || initial.url || "").trim(),
            };

            this.wrapper = null;
            this.formNode = null;
            this.previewNode = null;
            this.textInput = null;
            this.urlInput = null;
            this.previewLink = null;
            this.isEditMode = !this.readOnly && (!this.data.text || !this.data.link);
        }

        render() {
            this.wrapper = document.createElement("div");
            this.wrapper.className = "editorjs-wp-button-tool";

            this.formNode = document.createElement("div");
            this.formNode.className = "editorjs-wp-button-tool__form";

            this.textInput = document.createElement("input");
            this.textInput.type = "text";
            this.textInput.className = "editorjs-wp-button-tool__input";
            this.textInput.placeholder = this.labels.buttonTextPlaceholder || "Текст кнопки";
            this.textInput.value = this.data.text || "";
            this.textInput.disabled = this.readOnly;

            this.urlInput = document.createElement("input");
            this.urlInput.type = "url";
            this.urlInput.className = "editorjs-wp-button-tool__input";
            this.urlInput.placeholder = this.labels.buttonUrlPlaceholder || "https://example.com";
            this.urlInput.value = this.data.link || "";
            this.urlInput.disabled = this.readOnly;

            const actionsNode = document.createElement("div");
            actionsNode.className = "editorjs-wp-button-tool__actions";

            const applyButton = document.createElement("button");
            applyButton.type = "button";
            applyButton.className = "button button-secondary editorjs-wp-button-tool__apply";
            applyButton.textContent = this.labels.buttonApply || "Применить";
            applyButton.disabled = this.readOnly;
            applyButton.addEventListener("click", this.applyChanges.bind(this));

            actionsNode.appendChild(applyButton);
            this.formNode.appendChild(this.textInput);
            this.formNode.appendChild(this.urlInput);
            this.formNode.appendChild(actionsNode);

            this.previewNode = document.createElement("div");
            this.previewNode.className = "editorjs-wp-button-tool__preview";

            this.previewLink = document.createElement("a");
            this.previewLink.className = "editorjs-wp-any-button editorjs-wp-button-tool__preview-link";
            this.previewLink.target = "_blank";
            this.previewLink.rel = "noopener nofollow noreferrer";
            this.previewLink.href = "#";
            this.previewLink.textContent = this.labels.buttonDefaultText || "Кнопка";
            this.previewLink.addEventListener("click", this.handlePreviewClick.bind(this));
            this.previewNode.addEventListener("click", this.handlePreviewClick.bind(this));

            this.previewNode.appendChild(this.previewLink);
            this.wrapper.appendChild(this.formNode);
            this.wrapper.appendChild(this.previewNode);

            this.refreshView();

            return this.wrapper;
        }

        renderSettings() {
            if (this.readOnly) {
                return [];
            }

            return [
                {
                    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M3 17.25V21h3.75L17.8 9.95l-3.75-3.75L3 17.25Zm2.92 2H5v-.92l8.06-8.06.92.92L5.92 19.25ZM20.7 7.04a1 1 0 0 0 0-1.41L18.37 3.3a1 1 0 0 0-1.41 0l-1.75 1.75 3.75 3.75 1.74-1.76Z"/></svg>',
                    label: this.labels.buttonEditTune || "Редактировать кнопку",
                    onActivate: () => {
                        this.setEditMode(true);
                    },
                },
            ];
        }

        save() {
            const textValue = this.textInput ? String(this.textInput.value || "").trim() : this.data.text;
            const linkValue = this.normalizeLink(this.urlInput ? this.urlInput.value : this.data.link);

            return {
                text: textValue,
                link: linkValue,
            };
        }

        validate(savedData) {
            if (!savedData || typeof savedData !== "object") {
                return false;
            }

            const text = String(savedData.text || "").trim();
            const link = String(savedData.link || "").trim();

            return text !== "" && this.isValidHttpUrl(link);
        }

        applyChanges() {
            const text = String(this.textInput ? this.textInput.value : "").trim();
            const link = this.normalizeLink(this.urlInput ? this.urlInput.value : "");

            if (text === "") {
                this.notifyError(this.labels.buttonTextRequired || "Введите текст кнопки");
                return;
            }

            if (!this.isValidHttpUrl(link)) {
                this.notifyError(this.labels.buttonInvalidUrl || "Некорректный URL");
                return;
            }

            this.data = {
                text: text,
                link: link,
            };

            this.setEditMode(false);
        }

        setEditMode(enabled) {
            this.isEditMode = !!enabled && !this.readOnly;
            if (this.isEditMode) {
                if (this.textInput) {
                    this.textInput.value = this.data.text || "";
                }
                if (this.urlInput) {
                    this.urlInput.value = this.data.link || "";
                }
            }
            this.refreshView();
            if (this.isEditMode && this.textInput && typeof this.textInput.focus === "function") {
                this.textInput.focus();
            }
        }

        handlePreviewClick(event) {
            if (this.readOnly) {
                return;
            }
            if (event && typeof event.preventDefault === "function") {
                event.preventDefault();
            }
            this.setEditMode(true);
        }

        refreshView() {
            if (!this.formNode || !this.previewNode || !this.previewLink) {
                return;
            }

            const draftText = this.textInput ? String(this.textInput.value || "").trim() : this.data.text;
            const draftLink = this.normalizeLink(this.urlInput ? this.urlInput.value : this.data.link);
            const previewText = this.data.text || draftText || (this.labels.buttonDefaultText || "Кнопка");
            const previewLink = this.data.link || draftLink || "#";

            this.previewLink.textContent = previewText;
            this.previewLink.href = previewLink;

            this.formNode.classList.toggle("is-hidden", !this.isEditMode);
            this.previewNode.classList.toggle("is-hidden", this.isEditMode);
        }

        normalizeLink(rawLink) {
            const trimmed = String(rawLink || "").trim();
            if (trimmed === "") {
                return "";
            }

            if (/^www\./i.test(trimmed)) {
                return "https://" + trimmed;
            }

            return trimmed;
        }

        isValidHttpUrl(url) {
            if (!url) {
                return false;
            }

            try {
                const parsed = new URL(url);
                return parsed.protocol === "http:" || parsed.protocol === "https:";
            } catch (error) {
                return false;
            }
        }

        notifyError(message) {
            if (
                this.api
                && this.api.notifier
                && typeof this.api.notifier.show === "function"
            ) {
                this.api.notifier.show({
                    message: message,
                    style: "error",
                });
                return;
            }

            if (window && typeof window.alert === "function") {
                window.alert(message);
            }
        }
    }

    function getImageToolConfig(config) {
        return {
            class: window.ImageTool,
            config: {
                features: {
                    border: false,
                    stretch: false,
                    background: false,
                    caption: "optional",
                },
                uploader: {
                    uploadByFile: function (file) {
                        return uploadFile(
                            config.endpoints.uploadImage,
                            "image",
                            file,
                            resolveAjaxNonce(config),
                            getLabel(config, "imageUploadFailed", "РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РёР·РѕР±СЂР°Р¶РµРЅРёРµ.")
                        );
                    },
                },
            },
        };
    }

    window.EditorJSWPToolsFactory = function (config) {
        const tools = {};

        if (typeof window.Paragraph === "function") {
            tools.paragraph = {
                class: window.Paragraph,
                inlineToolbar: ["bold", "italic", "link"],
                config: {
                    placeholder: getLabel(config, "paragraphPlaceholder", "РќР°С‡РЅРёС‚Рµ РїРёСЃР°С‚СЊ..."),
                    preserveBlank: true,
                },
            };
        }

        if (typeof window.Header === "function") {
            tools.header = {
                class: window.Header,
                inlineToolbar: ["link", "bold", "italic"],
                config: {
                    levels: [2, 3, 4, 5, 6],
                    defaultLevel: 2,
                    placeholder: getLabel(config, "headerPlaceholder", "Р—Р°РіРѕР»РѕРІРѕРє"),
                },
            };
        }

        if (typeof window.ImageTool === "function") {
            tools.image = getImageToolConfig(config);
        }

        tools.video = {
            class: EditorJSWPVideoTool,
            inlineToolbar: false,
            config: {
                uploadUrl: config.endpoints.uploadVideo,
                posterUploadUrl: config.endpoints.uploadImage,
                nonce: resolveAjaxNonce(config),
                maxWidth: config.video.maxWidth,
                maxHeight: config.video.maxHeight,
                previewSecond: 5,
                labels: {
                    videoUpload: getLabel(config, "videoUpload", "Р—Р°РіСЂСѓР·РёС‚СЊ РІРёРґРµРѕ"),
                    videoCaption: getLabel(config, "videoCaption", "РџРѕРґРїРёСЃСЊ Рє РІРёРґРµРѕ"),
                    videoUploading: getLabel(config, "videoUploading", "Р—Р°РіСЂСѓР·РєР°..."),
                    videoUploaded: getLabel(config, "videoUploaded", "Р—Р°РіСЂСѓР¶РµРЅРѕ"),
                    videoPreviewGenerating: getLabel(config, "videoPreviewGenerating", "Р“РѕС‚РѕРІР»СЋ Р·Р°СЃС‚Р°РІРєСѓ (5-СЏ СЃРµРєСѓРЅРґР°)..."),
                    videoPreviewFailed: getLabel(
                        config,
                        "videoPreviewFailed",
                        "РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ Р·Р°СЃС‚Р°РІРєСѓ, Р±СѓРґРµС‚ СЃС‚Р°РЅРґР°СЂС‚РЅС‹Р№ РєР°РґСЂ."
                    ),
                    videoPreviewReady: getLabel(config, "videoPreviewReady", "Р—Р°СЃС‚Р°РІРєР° РіРѕС‚РѕРІР°"),
                    videoUploadFailed: getLabel(config, "videoUploadFailed", "РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РІРёРґРµРѕ."),
                },
            },
        };

        if (typeof window.CodeTool === "function") {
            tools.code = {
                class: window.CodeTool,
                config: {
                    placeholder: getLabel(config, "codePlaceholder", "Р’СЃС‚Р°РІСЊС‚Рµ РєРѕРґ"),
                },
            };
        }

        if (typeof window.Quote === "function") {
            tools.quote = {
                class: window.Quote,
                inlineToolbar: true,
                config: {
                    quotePlaceholder: getLabel(config, "quotePlaceholder", "Р¦РёС‚Р°С‚Р°"),
                    captionPlaceholder: getLabel(config, "quoteCaptionPlaceholder", "РђРІС‚РѕСЂ"),
                },
            };
        }

        if (typeof window.Delimiter === "function") {
            tools.delimiter = {
                class: window.Delimiter,
            };
        }

        if (typeof window.Table === "function") {
            tools.table = {
                class: window.Table,
                inlineToolbar: true,
                config: {
                    rows: 2,
                    cols: 2,
                },
            };
        }

        tools.AnyButton = {
            class: EditorJSWPButtonTool,
            inlineToolbar: false,
            config: {
                labels: {
                    buttonTextPlaceholder: getLabel(config, "buttonTextPlaceholder", "Текст кнопки"),
                    buttonUrlPlaceholder: getLabel(config, "buttonUrlPlaceholder", "https://example.com"),
                    buttonApply: getLabel(config, "buttonApply", "Применить"),
                    buttonEditTune: getLabel(config, "buttonEditTune", "Редактировать кнопку"),
                    buttonInvalidUrl: getLabel(config, "buttonInvalidUrl", "Некорректный URL"),
                    buttonTextRequired: getLabel(config, "buttonTextRequired", "Введите текст кнопки"),
                    buttonDefaultText: getLabel(config, "buttonDefaultText", "Кнопка"),
                },
            },
        };

        return tools;
    };
})(window);
