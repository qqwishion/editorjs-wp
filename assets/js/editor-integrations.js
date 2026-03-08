(function (window, document) {
    "use strict";

    function getLabel(config, key, fallback) {
        if (config && config.labels && typeof config.labels[key] === "string" && config.labels[key].trim() !== "") {
            return config.labels[key];
        }
        return fallback;
    }

    function stripHtml(value) {
        if (!value) {
            return "";
        }

        try {
            const doc = new DOMParser().parseFromString(String(value), "text/html");
            return (doc.body.textContent || "").trim();
        } catch (error) {
            return String(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        }
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function getIntegrationMount(holder) {
        if (!holder) {
            return null;
        }

        const shell = holder.closest(".editorjs-wp-admin-shell");
        if (!shell) {
            return null;
        }

        let mount = shell.querySelector(".editorjs-wp-integration-bar");
        if (mount) {
            return mount;
        }

        mount = document.createElement("div");
        mount.className = "editorjs-wp-integration-bar";
        const publishForm = shell.querySelector("form.publish-form");
        if (publishForm && publishForm.parentNode === shell) {
            shell.insertBefore(mount, publishForm);
            return mount;
        }

        if (holder.parentNode && typeof holder.parentNode.insertBefore === "function") {
            holder.parentNode.insertBefore(mount, holder);
            return mount;
        }

        shell.appendChild(mount);
        return mount;
    }

    function requestJson(url, method, payload, nonce) {
        const options = {
            method: method || "GET",
            credentials: "same-origin",
            headers: {
                Accept: "application/json",
            },
        };

        if (nonce) {
            options.headers["X-WP-Nonce"] = nonce;
        }

        if (payload && method && method.toUpperCase() !== "GET") {
            options.headers["Content-Type"] = "application/json; charset=utf-8";
            options.body = JSON.stringify(payload);
        }

        return fetch(url, options).then(function (response) {
            return response.text().then(function (rawText) {
                let data = null;
                try {
                    data = rawText ? JSON.parse(rawText) : null;
                } catch (error) {
                    data = null;
                }

                if (!response.ok) {
                    const message = data && data.message
                        ? data.message
                        : (
                            data && data.error
                                ? data.error
                                : (data && data.code && data.data && data.data.message ? data.data.message : "")
                        );
                    throw new Error(message || ("HTTP " + response.status));
                }

                return data;
            });
        });
    }

    function extractTextFromBlock(block) {
        if (!block || !block.type || !block.data) {
            return "";
        }

        const type = String(block.type).toLowerCase();
        const data = block.data;

        if (type === "paragraph" || type === "header" || type === "quote") {
            return stripHtml(data.text || "");
        }
        if (type === "code") {
            return String(data.code || "").trim();
        }
        if (type === "table" && Array.isArray(data.content)) {
            const rows = data.content.map(function (row) {
                if (!Array.isArray(row)) {
                    return "";
                }
                return row.map(function (cell) {
                    return stripHtml(cell || "");
                }).join(" | ");
            });
            return rows.join("\n").trim();
        }
        if (type === "anybutton" || type === "button") {
            return stripHtml(data.text || data.label || "");
        }

        return "";
    }

    function collectEditorText(outputData) {
        if (!outputData || !Array.isArray(outputData.blocks)) {
            return "";
        }

        const parts = outputData.blocks
            .map(extractTextFromBlock)
            .filter(function (part) {
                return !!part;
            });

        return parts.join("\n\n").trim();
    }

    function extractParagraphsFromHtml(html) {
        const text = stripHtml(html);
        if (!text) {
            return [];
        }

        const chunks = text
            .split(/\n{2,}/)
            .map(function (chunk) {
                return chunk.trim();
            })
            .filter(function (chunk) {
                return !!chunk;
            });

        if (chunks.length > 0) {
            return chunks;
        }

        return text.split(/\n+/).map(function (line) {
            return line.trim();
        }).filter(Boolean);
    }

    function buildRewrittenDataKeepingMedia(outputData, paragraphs) {
        const originalBlocks = Array.isArray(outputData && outputData.blocks) ? outputData.blocks : [];
        const textTypes = { paragraph: true, header: true, quote: true };
        const firstTextIndex = originalBlocks.findIndex(function (block) {
            return block && block.type && textTypes[String(block.type).toLowerCase()] === true;
        });

        const rewrittenBlocks = paragraphs.map(function (line) {
            return {
                type: "paragraph",
                data: {
                    text: escapeHtml(line),
                },
            };
        });

        if (firstTextIndex === -1) {
            return {
                time: Date.now(),
                version: outputData && outputData.version ? outputData.version : "2.31.4",
                blocks: rewrittenBlocks.concat(originalBlocks),
            };
        }

        const nextBlocks = [];
        originalBlocks.forEach(function (block, index) {
            const blockType = String((block && block.type) || "").toLowerCase();
            const isTextBlock = textTypes[blockType] === true;

            if (index === firstTextIndex) {
                rewrittenBlocks.forEach(function (rewritten) {
                    nextBlocks.push(rewritten);
                });
            }

            if (!isTextBlock) {
                nextBlocks.push(block);
            }
        });

        return {
            time: Date.now(),
            version: outputData && outputData.version ? outputData.version : "2.31.4",
            blocks: nextBlocks,
        };
    }

    function renderDataIntoEditor(editor, outputData) {
        if (!editor || !editor.blocks || typeof editor.blocks.render !== "function") {
            return Promise.reject(new Error("Editor.js render API is not available."));
        }

        return Promise.resolve(editor.blocks.render(outputData));
    }

    function syncHiddenField(hiddenField, outputData) {
        if (!hiddenField) {
            return;
        }
        hiddenField.value = JSON.stringify(outputData || {});
    }

    function syncAfterRender(editor, hiddenField, autosave, reason) {
        if (!editor || typeof editor.save !== "function") {
            return Promise.resolve();
        }

        return editor.save().then(function (nextData) {
            syncHiddenField(hiddenField, nextData);
            if (autosave && typeof autosave.persist === "function") {
                return autosave.persist(reason || "integration");
            }
            return undefined;
        });
    }

    function resolveTitleInput() {
        return document.getElementById("title")
            || document.querySelector('input[name="post_title"]')
            || document.querySelector("#post-title-0");
    }

    function applyPostTitle(titleText) {
        const titleInput = resolveTitleInput();
        if (!titleInput) {
            return false;
        }

        titleInput.value = titleText;
        titleInput.dispatchEvent(new Event("input", { bubbles: true }));
        titleInput.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
    }

    function resolveProviderAssetId(item) {
        if (!item) {
            return "";
        }
        if (item.provider_asset_id) {
            return String(item.provider_asset_id);
        }
        if (item.id && String(item.id).indexOf(":") !== -1) {
            return String(item.id).split(":").slice(1).join(":");
        }
        return "";
    }

    function createAiPanel(config, mount, editor, hiddenField, autosave) {
        const wrapper = document.createElement("div");
        wrapper.className = "editorjs-wp-integration-group";

        const button = document.createElement("button");
        button.type = "button";
        button.className = "editorjs-wp-integration-button";
        button.textContent = getLabel(config, "aiPanelToggle", "AI");

        const panel = document.createElement("div");
        panel.className = "editorjs-wp-integration-panel";

        const statusNode = document.createElement("div");
        statusNode.className = "editorjs-wp-integration-status";

        const customPromptField = document.createElement("textarea");
        customPromptField.className = "editorjs-wp-integration-textarea";
        customPromptField.placeholder = getLabel(config, "aiCustomPromptPlaceholder", "РљР°СЃС‚РѕРјРЅС‹Р№ РїСЂРѕРјРїС‚ (РѕРїС†РёРѕРЅР°Р»СЊРЅРѕ)");
        customPromptField.rows = 4;

        const actions = document.createElement("div");
        actions.className = "editorjs-wp-integration-actions";

        const rewriteButton = document.createElement("button");
        rewriteButton.type = "button";
        rewriteButton.className = "editorjs-wp-integration-button is-primary";
        rewriteButton.textContent = getLabel(config, "aiRewriteAction", "РџРµСЂРµРїРёСЃР°С‚СЊ С‚РµРєСЃС‚");

        const titlesButton = document.createElement("button");
        titlesButton.type = "button";
        titlesButton.className = "editorjs-wp-integration-button";
        titlesButton.textContent = getLabel(config, "aiTitlesAction", "РЎРіРµРЅРµСЂРёСЂРѕРІР°С‚СЊ Р·Р°РіРѕР»РѕРІРєРё");

        const titlesList = document.createElement("div");
        titlesList.className = "editorjs-wp-title-list";

        function setStatus(message, isError) {
            statusNode.textContent = message || "";
            statusNode.classList.toggle("is-error", !!isError);
            statusNode.classList.toggle("is-success", !isError && !!message);
        }

        function setBusy(isBusy) {
            rewriteButton.disabled = isBusy;
            titlesButton.disabled = isBusy;
            customPromptField.disabled = isBusy;
        }

        function callAiRewrite(customPrompt) {
            const endpoint = config && config.endpoints ? config.endpoints.aiRewrite : "";
            if (!endpoint) {
                return Promise.reject(new Error(getLabel(config, "aiUnavailable", "AI Rewriter РЅРµРґРѕСЃС‚СѓРїРµРЅ.")));
            }

            return editor.save().then(function (outputData) {
                const inputText = collectEditorText(outputData);
                if (!inputText) {
                    throw new Error(getLabel(config, "aiNoText", "РќРµС‚ С‚РµРєСЃС‚Р° РґР»СЏ РѕР±СЂР°Р±РѕС‚РєРё."));
                }

                const language = config && config.integrations
                    ? (config.integrations.aiLanguageDefault || "auto")
                    : "auto";

                return requestJson(
                    endpoint,
                    "POST",
                    {
                        text: inputText,
                        customPrompt: customPrompt || "",
                        language: language,
                    },
                    config.restNonce
                ).then(function (response) {
                    if (!response || response.ok === false || typeof response.html !== "string") {
                        throw new Error(
                            response && response.error
                                ? String(response.error)
                                : getLabel(config, "aiRewriteError", "РћС€РёР±РєР° AI Rewriter.")
                        );
                    }

                    const paragraphs = extractParagraphsFromHtml(response.html);
                    if (!paragraphs.length) {
                        throw new Error(getLabel(config, "aiEmptyResult", "AI РІРµСЂРЅСѓР» РїСѓСЃС‚РѕР№ СЂРµР·СѓР»СЊС‚Р°С‚."));
                    }

                    const nextData = buildRewrittenDataKeepingMedia(outputData, paragraphs);
                    return renderDataIntoEditor(editor, nextData).then(function () {
                        syncHiddenField(hiddenField, nextData);
                        return syncAfterRender(editor, hiddenField, autosave, "ai_rewrite");
                    });
                });
            });
        }

        function callAiTitles() {
            const endpoint = config && config.endpoints ? config.endpoints.aiTitles : "";
            if (!endpoint) {
                return Promise.reject(new Error(getLabel(config, "aiUnavailable", "AI Rewriter РЅРµРґРѕСЃС‚СѓРїРµРЅ.")));
            }

            return editor.save().then(function (outputData) {
                const inputText = collectEditorText(outputData);
                if (!inputText) {
                    throw new Error(getLabel(config, "aiNoText", "РќРµС‚ С‚РµРєСЃС‚Р° РґР»СЏ РѕР±СЂР°Р±РѕС‚РєРё."));
                }

                const language = config && config.integrations
                    ? (config.integrations.aiLanguageDefault || "auto")
                    : "auto";

                return requestJson(
                    endpoint,
                    "POST",
                    {
                        text: inputText,
                        language: language,
                    },
                    config.restNonce
                ).then(function (response) {
                    if (!response || response.ok === false || !Array.isArray(response.titles)) {
                        throw new Error(
                            response && response.error
                                ? String(response.error)
                                : getLabel(config, "aiTitlesError", "РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕР»СѓС‡РёС‚СЊ Р·Р°РіРѕР»РѕРІРєРё.")
                        );
                    }

                    const titles = response.titles
                        .map(function (title) {
                            return String(title || "").trim();
                        })
                        .filter(Boolean)
                        .slice(0, 5);

                    if (!titles.length) {
                        throw new Error(getLabel(config, "aiTitlesError", "РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕР»СѓС‡РёС‚СЊ Р·Р°РіРѕР»РѕРІРєРё."));
                    }

                    titlesList.innerHTML = "";
                    titles.forEach(function (title) {
                        const row = document.createElement("div");
                        row.className = "editorjs-wp-title-item";

                        const titleText = document.createElement("div");
                        titleText.className = "editorjs-wp-title-text";
                        titleText.textContent = title;

                        const applyButton = document.createElement("button");
                        applyButton.type = "button";
                        applyButton.className = "editorjs-wp-integration-button";
                        applyButton.textContent = getLabel(config, "aiApplyTitle", "РџСЂРёРјРµРЅРёС‚СЊ");
                        applyButton.addEventListener("click", function () {
                            const applied = applyPostTitle(title);
                            if (applied) {
                                setStatus(getLabel(config, "aiTitleApplied", "Р—Р°РіРѕР»РѕРІРѕРє РїСЂРёРјРµРЅРµРЅ."), false);
                            } else {
                                setStatus(getLabel(config, "aiTitleApplyManual", "РџРѕР»Рµ Р·Р°РіРѕР»РѕРІРєР° РЅРµ РЅР°Р№РґРµРЅРѕ. РЎРєРѕРїРёСЂСѓР№С‚Рµ РІСЂСѓС‡РЅСѓСЋ."), true);
                            }
                        });

                        row.appendChild(titleText);
                        row.appendChild(applyButton);
                        titlesList.appendChild(row);
                    });

                    setStatus(getLabel(config, "aiTitlesReady", "Р’Р°СЂРёР°РЅС‚С‹ Р·Р°РіРѕР»РѕРІРєРѕРІ РіРѕС‚РѕРІС‹."), false);
                });
            });
        }

        button.addEventListener("click", function () {
            panel.classList.toggle("is-open");
        });

        rewriteButton.addEventListener("click", function () {
            setBusy(true);
            titlesList.innerHTML = "";
            setStatus(getLabel(config, "aiProcessing", "РћР±СЂР°Р±РѕС‚РєР° AI..."), false);

            callAiRewrite(customPromptField.value.trim())
                .then(function () {
                    setStatus(getLabel(config, "aiRewriteDone", "РўРµРєСЃС‚ РѕР±РЅРѕРІР»РµРЅ."), false);
                })
                .catch(function (error) {
                    setStatus(error && error.message ? error.message : getLabel(config, "aiRewriteError", "РћС€РёР±РєР° AI Rewriter."), true);
                })
                .finally(function () {
                    setBusy(false);
                });
        });

        titlesButton.addEventListener("click", function () {
            setBusy(true);
            titlesList.innerHTML = "";
            setStatus(getLabel(config, "aiProcessing", "РћР±СЂР°Р±РѕС‚РєР° AI..."), false);

            callAiTitles()
                .catch(function (error) {
                    setStatus(error && error.message ? error.message : getLabel(config, "aiTitlesError", "РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕР»СѓС‡РёС‚СЊ Р·Р°РіРѕР»РѕРІРєРё."), true);
                })
                .finally(function () {
                    setBusy(false);
                });
        });

        actions.appendChild(rewriteButton);
        actions.appendChild(titlesButton);

        panel.appendChild(customPromptField);
        panel.appendChild(actions);
        panel.appendChild(statusNode);
        panel.appendChild(titlesList);

        wrapper.appendChild(button);
        wrapper.appendChild(panel);
        mount.appendChild(wrapper);
    }

    function createStockModal(config, editor, hiddenField, autosave) {
        const modal = document.createElement("div");
        modal.className = "editorjs-wp-stock-modal";
        modal.innerHTML = ""
            + '<div class="editorjs-wp-stock-backdrop"></div>'
            + '<div class="editorjs-wp-stock-dialog">'
            + '  <div class="editorjs-wp-stock-header">'
            + '    <h3>' + escapeHtml(getLabel(config, "stockModalTitle", "РџРѕРёСЃРє РёР·РѕР±СЂР°Р¶РµРЅРёР№")) + "</h3>"
            + '    <button type="button" class="editorjs-wp-stock-close" aria-label="' + escapeHtml(getLabel(config, "closeLabel", "Р—Р°РєСЂС‹С‚СЊ")) + '"><span aria-hidden="true">&times;</span></button>'
            + "  </div>"
            + '  <div class="editorjs-wp-stock-controls">'
            + '    <input type="text" class="editorjs-wp-stock-query" placeholder="' + escapeHtml(getLabel(config, "stockQueryPlaceholder", "Р’РІРµРґРёС‚Рµ Р·Р°РїСЂРѕСЃ")) + '" />'
            + '    <button type="button" class="editorjs-wp-integration-button is-primary editorjs-wp-stock-search-btn">' + escapeHtml(getLabel(config, "stockSearchAction", "РСЃРєР°С‚СЊ")) + "</button>"
            + "  </div>"
            + '  <div class="editorjs-wp-stock-providers"></div>'
            + '  <div class="editorjs-wp-stock-status"></div>'
            + '  <div class="editorjs-wp-stock-results"></div>'
            + "</div>";

        const providersNode = modal.querySelector(".editorjs-wp-stock-providers");
        const statusNode = modal.querySelector(".editorjs-wp-stock-status");
        const resultsNode = modal.querySelector(".editorjs-wp-stock-results");
        const queryInput = modal.querySelector(".editorjs-wp-stock-query");
        const searchButton = modal.querySelector(".editorjs-wp-stock-search-btn");

        const providerState = {
            wikimedia: true,
            unsplash: true,
            pexels: true,
            pixabay: true,
        };

        function setStatus(message, isError) {
            statusNode.textContent = message || "";
            statusNode.classList.toggle("is-error", !!isError);
            statusNode.classList.toggle("is-success", !isError && !!message);
        }

        function selectedProviders() {
            return Object.keys(providerState).filter(function (key) {
                return providerState[key];
            });
        }

        function renderProviders() {
            providersNode.innerHTML = "";
            Object.keys(providerState).forEach(function (provider) {
                const label = document.createElement("label");
                label.className = "editorjs-wp-stock-provider";

                const input = document.createElement("input");
                input.type = "checkbox";
                input.checked = providerState[provider];
                input.addEventListener("change", function () {
                    providerState[provider] = input.checked;
                });

                const text = document.createElement("span");
                text.textContent = provider;

                label.appendChild(input);
                label.appendChild(text);
                providersNode.appendChild(label);
            });
        }

        function closeModal() {
            modal.classList.remove("is-open");
        }

        function openModal() {
            modal.classList.add("is-open");
            queryInput.focus();
        }

        function insertImageToEditor(attachmentUrl, captionHtml) {
            return editor.save().then(function (outputData) {
                const nextBlocks = Array.isArray(outputData.blocks) ? outputData.blocks.slice() : [];
                nextBlocks.push({
                    type: "image",
                    data: {
                        file: { url: attachmentUrl },
                        url: attachmentUrl,
                        caption: captionHtml || "",
                    },
                });

                const nextData = {
                    time: Date.now(),
                    version: outputData.version || "2.31.4",
                    blocks: nextBlocks,
                };

                return renderDataIntoEditor(editor, nextData).then(function () {
                    syncHiddenField(hiddenField, nextData);
                    return syncAfterRender(editor, hiddenField, autosave, "stock_insert");
                });
            });
        }

        function runInsert(item, insertButton) {
            const endpoint = config && config.endpoints ? config.endpoints.stockInsert : "";
            if (!endpoint) {
                setStatus(getLabel(config, "stockUnavailable", "Stock Image Search РЅРµРґРѕСЃС‚СѓРїРµРЅ."), true);
                return;
            }

            if (!item || !item.provider || !item.download_info) {
                setStatus(getLabel(config, "stockBadItem", "РќРµРєРѕСЂСЂРµРєС‚РЅС‹Рµ РґР°РЅРЅС‹Рµ РёР·РѕР±СЂР°Р¶РµРЅРёСЏ."), true);
                return;
            }

            insertButton.disabled = true;
            setStatus(getLabel(config, "stockInserting", "Р’СЃС‚Р°РІР»СЏСЋ РёР·РѕР±СЂР°Р¶РµРЅРёРµ..."), false);

            requestJson(
                endpoint,
                "POST",
                {
                    id: item.id,
                    provider: item.provider,
                    provider_asset_id: resolveProviderAssetId(item),
                    download_info: item.download_info,
                },
                config.restNonce
            )
                .then(function (response) {
                    if (!response || !response.attachment_url) {
                        throw new Error(getLabel(config, "stockInsertError", "РќРµ СѓРґР°Р»РѕСЃСЊ РІСЃС‚Р°РІРёС‚СЊ РёР·РѕР±СЂР°Р¶РµРЅРёРµ."));
                    }
                    return insertImageToEditor(
                        String(response.attachment_url),
                        String(response.caption_html || "")
                    );
                })
                .then(function () {
                    setStatus(getLabel(config, "stockInsertDone", "РР·РѕР±СЂР°Р¶РµРЅРёРµ РІСЃС‚Р°РІР»РµРЅРѕ."), false);
                    closeModal();
                })
                .catch(function (error) {
                    setStatus(error && error.message ? error.message : getLabel(config, "stockInsertError", "РќРµ СѓРґР°Р»РѕСЃСЊ РІСЃС‚Р°РІРёС‚СЊ РёР·РѕР±СЂР°Р¶РµРЅРёРµ."), true);
                })
                .finally(function () {
                    insertButton.disabled = false;
                });
        }

        function renderResults(items, providerErrors) {
            resultsNode.innerHTML = "";

            if (Array.isArray(providerErrors) && providerErrors.length) {
                const warning = document.createElement("div");
                warning.className = "editorjs-wp-stock-provider-errors";
                warning.textContent = providerErrors
                    .map(function (entry) {
                        if (!entry || !entry.provider) {
                            return "";
                        }
                        return String(entry.provider) + ": " + String(entry.message || "");
                    })
                    .filter(Boolean)
                    .join("; ");
                if (warning.textContent) {
                    resultsNode.appendChild(warning);
                }
            }

            if (!Array.isArray(items) || !items.length) {
                const empty = document.createElement("div");
                empty.className = "editorjs-wp-stock-empty";
                empty.textContent = getLabel(config, "stockNoResults", "РќРёС‡РµРіРѕ РЅРµ РЅР°Р№РґРµРЅРѕ.");
                resultsNode.appendChild(empty);
                return;
            }

            items.forEach(function (item) {
                const card = document.createElement("div");
                card.className = "editorjs-wp-stock-card";

                const image = document.createElement("img");
                image.className = "editorjs-wp-stock-thumb";
                image.src = item.thumb_url || "";
                image.alt = "";
                image.loading = "lazy";

                const meta = document.createElement("div");
                meta.className = "editorjs-wp-stock-meta";
                meta.textContent = [item.provider || "", item.author_name || ""].filter(Boolean).join(" В· ");

                const insertButton = document.createElement("button");
                insertButton.type = "button";
                insertButton.className = "editorjs-wp-integration-button";
                insertButton.textContent = getLabel(config, "stockInsertAction", "Р’СЃС‚Р°РІРёС‚СЊ");
                insertButton.addEventListener("click", function () {
                    runInsert(item, insertButton);
                });

                card.appendChild(image);
                card.appendChild(meta);
                card.appendChild(insertButton);
                resultsNode.appendChild(card);
            });
        }

        function runSearch() {
            const endpoint = config && config.endpoints ? config.endpoints.stockSearch : "";
            if (!endpoint) {
                setStatus(getLabel(config, "stockUnavailable", "Stock Image Search РЅРµРґРѕСЃС‚СѓРїРµРЅ."), true);
                return;
            }

            const query = String(queryInput.value || "").trim();
            if (!query) {
                setStatus(getLabel(config, "stockQueryRequired", "Р’РІРµРґРёС‚Рµ РїРѕРёСЃРєРѕРІС‹Р№ Р·Р°РїСЂРѕСЃ."), true);
                return;
            }

            const providers = selectedProviders();
            if (!providers.length) {
                setStatus(getLabel(config, "stockProviderRequired", "Р’С‹Р±РµСЂРёС‚Рµ С…РѕС‚СЏ Р±С‹ РѕРґРёРЅ РёСЃС‚РѕС‡РЅРёРє."), true);
                return;
            }

            setStatus(getLabel(config, "stockSearching", "РС‰Сѓ РёР·РѕР±СЂР°Р¶РµРЅРёСЏ..."), false);
            resultsNode.innerHTML = "";

            const params = new URLSearchParams();
            params.append("query", query);
            params.append("page", "1");
            providers.forEach(function (provider) {
                params.append("providers[]", provider);
            });

            requestJson(
                endpoint + "?" + params.toString(),
                "GET",
                null,
                config.restNonce
            )
                .then(function (response) {
                    renderResults(
                        Array.isArray(response && response.results) ? response.results : [],
                        Array.isArray(response && response.provider_errors) ? response.provider_errors : []
                    );
                    setStatus("", false);
                })
                .catch(function (error) {
                    setStatus(error && error.message ? error.message : getLabel(config, "stockSearchError", "РћС€РёР±РєР° РїРѕРёСЃРєР°."), true);
                });
        }

        modal.querySelector(".editorjs-wp-stock-backdrop").addEventListener("click", closeModal);
        modal.querySelector(".editorjs-wp-stock-close").addEventListener("click", closeModal);
        searchButton.addEventListener("click", runSearch);
        queryInput.addEventListener("keydown", function (event) {
            if (event.key === "Enter") {
                event.preventDefault();
                runSearch();
            }
        });

        renderProviders();
        document.body.appendChild(modal);

        return {
            open: openModal,
        };
    }

    function moveFrontendAutosaveStatusToIntegrationBar(config, mount) {
        if (!config || !config.isFrontendEditor || !mount) {
            return;
        }

        const statusNode = document.getElementById("editorjs-wp-autosave-status");
        if (!statusNode) {
            return;
        }

        let statusGroup = mount.querySelector(".editorjs-wp-integration-group--autosave");
        if (!statusGroup) {
            statusGroup = document.createElement("div");
            statusGroup.className = "editorjs-wp-integration-group editorjs-wp-integration-group--autosave";
            mount.appendChild(statusGroup);
        }

        statusNode.classList.add("editorjs-wp-autosave-status--inline");
        statusGroup.appendChild(statusNode);
    }

    function attachStockOpenHandler(button, stockModal) {
        if (!button || !stockModal || typeof stockModal.open !== "function") {
            return;
        }

        if (button.dataset.editorjsStockBound === "1") {
            return;
        }

        button.addEventListener("click", function () {
            stockModal.open();
        });
        button.dataset.editorjsStockBound = "1";
    }

    window.EditorJSWPIntegrationsBootstrap = function (editor, config, context) {
        if (!editor || !config || !context || !context.holder) {
            return;
        }

        const integrations = config.integrations || {};
        const aiEnabled = !!integrations.aiRewriter && !config.isFrontendEditor;
        const stockEnabled = !!integrations.stockImageSearch;
        const hasPreRenderedStockButton = !!document.getElementById("editorjs-wp-stock-open");

        if (!aiEnabled && !stockEnabled && !hasPreRenderedStockButton) {
            return;
        }

        const mount = getIntegrationMount(context.holder);
        if (!mount) {
            return;
        }

        if (aiEnabled) {
            createAiPanel(config, mount, editor, context.hiddenField, context.autosave || null);
        }

        if (stockEnabled) {
            const stockModal = createStockModal(config, editor, context.hiddenField, context.autosave || null);
            let button = mount.querySelector("#editorjs-wp-stock-open");

            if (!button) {
                const group = document.createElement("div");
                group.className = "editorjs-wp-integration-group";

                button = document.createElement("button");
                button.type = "button";
                button.id = "editorjs-wp-stock-open";
                button.className = "editorjs-wp-integration-button";
                button.textContent = getLabel(config, "stockPanelToggle", "Поиск фото");

                group.appendChild(button);
                mount.appendChild(group);
            } else {
                button.classList.add("editorjs-wp-integration-button");
                button.disabled = false;
                button.title = "";
                button.textContent = getLabel(config, "stockPanelToggle", "Поиск фото");
            }

            attachStockOpenHandler(button, stockModal);
        } else {
            const stockButton = mount.querySelector("#editorjs-wp-stock-open");
            if (stockButton) {
                stockButton.disabled = true;
                stockButton.title = getLabel(config, "stockUnavailable", "Stock Image Search недоступен.");
            }
        }

        moveFrontendAutosaveStatusToIntegrationBar(config, mount);
    };
})(window, document);

