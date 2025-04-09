(function(){
    const config = {
        trackingParams: ["gclid", "gbraid", "wbraid", "msclkid", "fbclid"],
        storageKey: "tracking_params",
        storageExpiryKey: "tracking_params_expiry",
        storageDuration: 2592000000 // 30 dias
    };

    const bots = [
        /googlebot\//i,
        /bingbot/i,
        /yandexbot/i,
        /duckduckbot/i,
        /baiduspider/i,
        /facebookexternalhit\//i,
        /twitterbot/i,
        /linkedinbot/i,
        /pinterest/i
    ];

    class Tracker {
        constructor() {
            this.isCrawlerVisitor = this.isCrawler();
            this.trackingId = "desconhecido";
            this.storedParams = {};
            this.initialize();
        }

        isCrawler() {
            const ua = navigator.userAgent.toLowerCase();
            return bots.some(bot => bot.test(ua));
        }

        initialize() {
            if (this.isCrawlerVisitor) return;
            const stored = this.getStoredParameters();
            if (stored) {
                this.storedParams = stored.params;
                this.trackingId = this.getTrackingIdFromParams(stored.params);
            }
            this.processUrlParameters();
        }

        getTrackingIdFromParams(params) {
            for (const key of config.trackingParams) {
                if (params[key]) return params[key];
            }
            return "desconhecido";
        }

        encodeSpecialChars(value) {
            return value
                .replace(/ /g, "_s_")
                .replace(/-/g, "_d_")
                .replace(/\//g, "");
        }

        processUrlParameters() {
            const searchParams = new URLSearchParams(window.location.search);
            let found = false;
            searchParams.forEach((value, key) => {
                this.storedParams[key] = value;
                if (config.trackingParams.includes(key)) {
                    this.trackingId = value;
                    found = true;
                }
            });
            if (found) {
                this.storeParameters(this.storedParams);
                this.removeTrackingParamsFromUrl(config.trackingParams);
            }
        }

        removeTrackingParamsFromUrl(paramsToRemove) {
            const url = new URL(window.location.href);
            let changed = false;
            for (const param of paramsToRemove) {
                if (url.searchParams.has(param)) {
                    url.searchParams.delete(param);
                    changed = true;
                }
            }
            if (changed) {
                window.history.replaceState({}, document.title, url.toString());
            }
        }

        storeParameters(params) {
            const data = {
                params: params,
                timestamp: new Date().getTime()
            };
            try {
                localStorage.setItem(config.storageKey, JSON.stringify(data));
                localStorage.setItem(
                    config.storageExpiryKey,
                    (new Date().getTime() + config.storageDuration).toString()
                );
            } catch (e) {
                console.warn("Erro ao salvar parâmetros:", e);
            }
        }

        getStoredParameters() {
            try {
                const raw = localStorage.getItem(config.storageKey);
                const expiry = localStorage.getItem(config.storageExpiryKey);
                if (!raw || !expiry) return null;
                if (new Date().getTime() > parseInt(expiry)) {
                    localStorage.removeItem(config.storageKey);
                    localStorage.removeItem(config.storageExpiryKey);
                    return null;
                }
                return JSON.parse(raw);
            } catch (e) {
                console.warn("Erro ao recuperar parâmetros:", e);
                return null;
            }
        }

        processPageLinks() {
            if (this.isCrawlerVisitor) return;

            const links = document.getElementsByTagName("a");

            for (let i = 0; i < links.length; i++) {
                const link = links[i];
                const originalHref = link.href.split("#")[0];
                const anchor = link.hash;

                try {
                    const url = new URL(originalHref, document.location.href);
                    const searchParams = url.searchParams;

                    // Substituir [cnlid] ou %5Bcnlid%5D com o trackingId
                    searchParams.forEach((value, key) => {
                        if (value.includes("[cnlid]") || value.includes("%5Bcnlid%5D")) {
                            const replaced = value
                                .replace(/\[cnlid\]/g, this.trackingId)
                                .replace(/%5Bcnlid%5D/g, this.trackingId);
                            searchParams.set(
                                key,
                                key.toLowerCase() === "tid"
                                    ? this.encodeSpecialChars(replaced)
                                    : replaced
                            );
                        } else if (key.toLowerCase() === "tid") {
                            searchParams.set(key, this.encodeSpecialChars(value));
                        }
                    });

                    // Adiciona trackingId apenas em sub2, se estiver presente
                    if (searchParams.has("sub2")) {
                        searchParams.set("sub2", this.trackingId);
                    }

                    // Adiciona os parâmetros salvos, exceto os de rastreamento direto (gclid, etc.)
                    Object.entries(this.storedParams).forEach(([key, value]) => {
                        if (
                            !config.trackingParams.includes(key.toLowerCase()) &&
                            !searchParams.has(key)
                        ) {
                            searchParams.set(
                                key,
                                key.toLowerCase() === "tid"
                                    ? this.encodeSpecialChars(value)
                                    : value
                            );
                        }
                    });

                    link.href = url.toString() + anchor;
                } catch (e) {
                    console.warn("Erro ao processar link:", link.href, e);
                }
            }
        }
    }

    document.addEventListener("DOMContentLoaded", function () {
        console.log("🚀 Inicializando...");
        const tracker = new Tracker();
        tracker.processPageLinks();
        console.log("✅Pronto!");
    });
})();
