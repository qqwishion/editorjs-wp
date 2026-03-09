(function (window, document) {
    "use strict";

    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            const script = document.createElement("script");
            script.src = src;
            script.async = false;
            script.onload = function () { resolve(); };
            script.onerror = function () { reject(new Error("Failed to load: " + src)); };
            (document.head || document.documentElement).appendChild(script);
        });
    }

    function guardValue(checker) {
        try {
            return !!checker();
        } catch (error) {
            return false;
        }
    }

    const fallbacks = [
        { check: function () { return typeof window.EditorJS === "function"; }, src: "https://cdn.jsdelivr.net/npm/@editorjs/editorjs@2.31.4" },
        { check: function () { return typeof window.Paragraph === "function"; }, src: "https://cdn.jsdelivr.net/npm/@editorjs/paragraph@2.11.7/dist/paragraph.umd.min.js" },
        { check: function () { return typeof window.Header === "function"; }, src: "https://cdn.jsdelivr.net/npm/@editorjs/header@2.8.8/dist/header.umd.min.js" },
        { check: function () { return typeof window.ImageTool === "function"; }, src: "https://cdn.jsdelivr.net/npm/@editorjs/image@2.10.3/dist/image.umd.min.js" },
        { check: function () { return typeof window.CodeTool === "function"; }, src: "https://cdn.jsdelivr.net/npm/@editorjs/code@2.9.4/dist/code.umd.min.js" },
        { check: function () { return typeof window.Quote === "function"; }, src: "https://cdn.jsdelivr.net/npm/@editorjs/quote@2.7.6/dist/quote.umd.min.js" },
        { check: function () { return typeof window.Delimiter === "function"; }, src: "https://cdn.jsdelivr.net/npm/@editorjs/delimiter@1.4.2/dist/delimiter.umd.min.js" },
        { check: function () { return typeof window.Table === "function"; }, src: "https://cdn.jsdelivr.net/npm/@editorjs/table@2.4.5/dist/table.umd.min.js" },
        { check: function () { return typeof window.DragDrop === "function"; }, src: "https://cdn.jsdelivr.net/npm/editorjs-drag-drop@1.1.16/dist/bundle.js" },
    ];

    const previous = window.EditorJSWPReadyPromise && typeof window.EditorJSWPReadyPromise.then === "function"
        ? window.EditorJSWPReadyPromise
        : Promise.resolve();

    window.EditorJSWPReadyPromise = previous.then(async function () {
        for (let index = 0; index < fallbacks.length; index += 1) {
            const item = fallbacks[index];
            if (guardValue(item.check)) {
                continue;
            }

            try {
                await loadScript(item.src);
            } catch (error) {
                // Keep going: editor-init will still try to start with whatever is available.
                if (window.console && typeof window.console.warn === "function") {
                    window.console.warn("[EditorJS WP] Fallback load failed:", item.src, error);
                }
            }
        }
    });
})(window, document);
