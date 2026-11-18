/*!
 * logo.js - QuickBill logo helper
 *   - initials(name):  1-2 letters for the auto-generated badge
 *   - badge(text, px): HTML for the indigo initials badge
 *   - processFile(f):  validates an uploaded image and shrinks it (stays on the device)
 *   - render(mode, upload, name): HTML for the bill header ('' when no logo)
 *   - save()/load():   remembers the choice in this browser (separate key from business details)
 * Exposes: window.QBLogo
 */
(function (global) {
    'use strict';

    var KEY = 'qb_logo';
    var ACCENT = '#4338ca';
    var MAX_FILE_BYTES = 8 * 1024 * 1024;   // refuse huge originals before decoding
    var STORE_W = 480, STORE_H = 192;       // stored size (sharp enough for A4 at 2x)
    var SHOW_W = 140, SHOW_H = 56;          // size on the bill
    var BADGE_PX = 52;
    var DATA_RE = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+\/]+=*$/;

    var STOP = { the: 1, and: 1, of: 1, a: 1, an: 1, '&': 1, pvt: 1, ltd: 1, llc: 1, inc: 1, co: 1, corp: 1, private: 1, limited: 1 };

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function graphemes(str) {
        try {
            if (typeof Intl !== 'undefined' && Intl.Segmenter) {
                return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(str), function (x) { return x.segment; });
            }
        } catch (e) {}
        return Array.from(str);
    }

    function initials(name) {
        name = String(name || '').trim();
        if (!name) return '';
        var words = name.split(/[\s\-_.,]+/).filter(Boolean);
        var main = words.filter(function (w) { return !STOP[w.toLowerCase()]; });
        if (!main.length) main = words;
        main = main.map(function (w) { return w.replace(/^[^\p{L}\p{N}]+/u, ''); }).filter(Boolean);
        if (!main.length) return '';
        var out;
        if (main.length >= 2) out = graphemes(main[0])[0] + graphemes(main[1])[0];
        else out = graphemes(main[0]).slice(0, 2).join('');
        return out.toUpperCase();
    }

    function badge(text, px) {
        px = px || BADGE_PX;
        // 1-2 letters use the normal size; longer clusters (e.g. Devanagari conjuncts) shrink to fit the badge
        var n = Array.from(String(text)).length;
        var fs = Math.round(px * (n <= 2 ? 0.4 : Math.max(0.2, 0.8 / n)));
        return '<div style="width:' + px + 'px;height:' + px + 'px;line-height:' + px + 'px;background:' + ACCENT +
            ';color:#ffffff;font-weight:700;font-size:' + fs + 'px;text-align:center;border-radius:10px;' +
            'font-family:Inter,Arial,sans-serif;letter-spacing:0.5px;overflow:hidden;">' + esc(text) + '</div>';
    }

    // Validate, then shrink on a canvas. Resolves { data, w, h } (data is a PNG, or JPEG if the PNG would be large).
    function processFile(file) {
        return new Promise(function (resolve, reject) {
            if (!file) return reject(new Error('No file chosen.'));
            if (['image/png', 'image/jpeg', 'image/webp'].indexOf(file.type) === -1) {
                return reject(new Error('Please choose a PNG, JPG or WebP image.'));
            }
            if (file.size > MAX_FILE_BYTES) {
                return reject(new Error('That file is too large. Please choose an image under 8 MB.'));
            }
            var url = URL.createObjectURL(file);
            var img = new Image();
            img.onload = function () {
                URL.revokeObjectURL(url);
                var w = img.naturalWidth, h = img.naturalHeight;
                if (!w || !h) return reject(new Error('That image could not be read.'));
                var scale = Math.min(1, STORE_W / w, STORE_H / h);
                var cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
                try {
                    var c = document.createElement('canvas');
                    c.width = cw; c.height = ch;
                    c.getContext('2d').drawImage(img, 0, 0, cw, ch);
                    var data = c.toDataURL('image/png');
                    if (data.length > 300000) {            // photo-like logo: JPEG is much smaller
                        var c2 = document.createElement('canvas');
                        c2.width = cw; c2.height = ch;
                        var x2 = c2.getContext('2d');
                        x2.fillStyle = '#ffffff'; x2.fillRect(0, 0, cw, ch);
                        x2.drawImage(img, 0, 0, cw, ch);
                        data = c2.toDataURL('image/jpeg', 0.85);
                    }
                    if (!DATA_RE.test(data)) return reject(new Error('That image could not be processed.'));
                    resolve({ data: data, w: cw, h: ch });
                } catch (e) {
                    reject(new Error('That image could not be processed.'));
                }
            };
            img.onerror = function () {
                URL.revokeObjectURL(url);
                reject(new Error('That image could not be opened. Please try a PNG or JPG.'));
            };
            img.src = url;
        });
    }

    function validUpload(u) {
        return !!(u && typeof u.data === 'string' && DATA_RE.test(u.data) && u.w > 0 && u.h > 0);
    }

    // mode: 'none' | 'auto' | 'upload';  upload: { data, w, h };  name: business name
    function render(mode, upload, name) {
        if (mode === 'auto') {
            var ini = initials(name);
            return ini ? badge(ini, BADGE_PX) : '';
        }
        if (mode === 'upload' && validUpload(upload)) {
            var f = Math.min(1, SHOW_W / upload.w, SHOW_H / upload.h);
            var dw = Math.max(1, Math.round(upload.w * f)), dh = Math.max(1, Math.round(upload.h * f));
            return '<img src="' + upload.data + '" alt="Logo" width="' + dw + '" height="' + dh + '" style="display:block;width:' + dw + 'px;height:' + dh + 'px;">';
        }
        return '';
    }

    function save(mode, upload) {
        try {
            localStorage.setItem(KEY, JSON.stringify({
                mode: mode,
                data: validUpload(upload) ? upload.data : '',
                w: validUpload(upload) ? upload.w : 0,
                h: validUpload(upload) ? upload.h : 0
            }));
            return true;
        } catch (e) { return false; }
    }

    function load() {
        try {
            var o = JSON.parse(localStorage.getItem(KEY) || 'null');
            if (!o || ['none', 'auto', 'upload'].indexOf(o.mode) === -1) return null;
            var up = { data: o.data, w: Number(o.w), h: Number(o.h) };
            if (!validUpload(up)) up = { data: '', w: 0, h: 0 };
            return { mode: o.mode, upload: up };
        } catch (e) { return null; }
    }

    global.QBLogo = { initials: initials, badge: badge, processFile: processFile, render: render, save: save, load: load, validUpload: validUpload };
})(window);
