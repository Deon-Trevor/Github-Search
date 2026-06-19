/* ==========================================================================
   dom.js — query helpers + the cached element lookup table.
   Nothing here touches network or app state; it only knows about the DOM.
   ========================================================================== */

export const $ = (sel) => document.querySelector(sel);
export const $$ = (sel) => Array.from(document.querySelectorAll(sel));

export const el = {
    // Mode
    modeTabs: $$("[data-mode]"),
    panels: {
        profile: $("#panel-profile"),
        userfinder: $("#panel-userfinder"),
        global: $("#panel-global"),
    },

    // Rate
    rateRemaining: $("#rate-remaining"),
    ratePill: $("#rate-pill"),

    // Profile panel
    username: $("#profile-username"),
    repoGrid: $("#repo-grid"),
    repoCount: $("#repo-count"),
    repoPage: $("#repo-page"),
    sort: $("#profile-sort"),
    filter: $("#profile-filter"),
    btnScan: $("#btn-scan"),
    btnClear: $("#btn-clear"),
    btnPrev: $("#btn-prev"),
    btnNext: $("#btn-next"),
    btnExportJson: $("#btn-export-json"),
    btnExportCsv: $("#btn-export-csv"),
    btnCopyProfileURL: $("#btn-copy-profile-url"),
    profileCard: $("#profile-card"),

    // Finder
    finderQuery: $("#finder-query"),
    btnFinderSearch: $("#btn-finder-search"),
    finderResults: $("#finder-results"),

    // Global search
    globalQ: $("#global-q"),
    globalKind: $("#global-kind"),
    btnGlobalSearch: $("#btn-global-search"),
    btnCopyGlobalURL: $("#btn-copy-global-url"),
    globalResults: $("#global-results"),
    presetChips: $("#preset-chips"),
    builderChips: $("#builder-chips"),

    // Token
    token: $("#github-token"),
    authMenu: $(".auth-menu"),

    // Modal
    modal: $("#label-modal"),
    modalPanel: $('[data-modal-panel]'),
    modalList: $("#label-list"),
    modalFilter: $("#label-filter"),
    modalClose: $("#label-close"),
    repoModal: $("#repo-modal"),
    repoModalPanel: $('[data-repo-modal-panel]'),
    repoModalBody: $("#repo-detail-body"),
    repoModalClose: $("#repo-detail-close"),

    // System
    errorBanner: $("#error-banner"),
    toastContainer: $("#toast-container"),
};
