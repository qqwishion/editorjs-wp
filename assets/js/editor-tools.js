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

        if (payload.success === 1) {
            return payload;
        }

        if (payload.success === false && payload.data && payload.data.message) {
            throw new Error(payload.data.message);
        }

        if (payload.message) {
            throw new Error(payload.message);
        }

        throw new Error(defaultMessage);
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

        if (typeof window.AnyButton === "function") {
            tools.AnyButton = {
                class: window.AnyButton,
                inlineToolbar: false,
                config: {
                    css: {
                        btnColor: "editorjs-wp-any-button",
                    },
                },
            };
        }

        return tools;
    };
})(window);
