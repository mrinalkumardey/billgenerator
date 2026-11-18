/*!
 * geo.js - QuickBill region helper
 * Detects the visitor's country (IP lookup, with a browser-based fallback) and provides:
 *   - currency info (symbol, decimals) built from Intl, nothing hard-coded per country
 *   - phone country code
 *   - default tax name / tax-ID label / rate for the region
 * Exposes: window.QBGeo
 */
(function (global) {
    'use strict';

    // country -> [phone code, currency code]  (fallback only; the IP lookup supplies its own values)
    var REGION = {
        IN:['+91','INR'], US:['+1','USD'], CA:['+1','CAD'], GB:['+44','GBP'], IE:['+353','EUR'], DE:['+49','EUR'], FR:['+33','EUR'],
        ES:['+34','EUR'], IT:['+39','EUR'], NL:['+31','EUR'], PT:['+351','EUR'], BE:['+32','EUR'], AT:['+43','EUR'], FI:['+358','EUR'],
        GR:['+30','EUR'], AU:['+61','AUD'], NZ:['+64','NZD'], SG:['+65','SGD'], MY:['+60','MYR'], ID:['+62','IDR'], TH:['+66','THB'],
        PH:['+63','PHP'], VN:['+84','VND'], JP:['+81','JPY'], KR:['+82','KRW'], CN:['+86','CNY'], HK:['+852','HKD'], AE:['+971','AED'],
        SA:['+966','SAR'], QA:['+974','QAR'], PK:['+92','PKR'], BD:['+880','BDT'], LK:['+94','LKR'], NP:['+977','NPR'], ZA:['+27','ZAR'],
        NG:['+234','NGN'], KE:['+254','KES'], EG:['+20','EGP'], BR:['+55','BRL'], MX:['+52','MXN'], AR:['+54','ARS'], CH:['+41','CHF'],
        SE:['+46','SEK'], NO:['+47','NOK'], DK:['+45','DKK'], PL:['+48','PLN'], TR:['+90','TRY'], RU:['+7','RUB']
    };

    var TZ_COUNTRY = {
        'Asia/Kolkata':'IN','Asia/Calcutta':'IN','Europe/London':'GB','America/New_York':'US','America/Chicago':'US','America/Denver':'US',
        'America/Los_Angeles':'US','America/Toronto':'CA','America/Vancouver':'CA','Australia/Sydney':'AU','Australia/Melbourne':'AU',
        'Asia/Dubai':'AE','Asia/Singapore':'SG','Asia/Dhaka':'BD','Asia/Karachi':'PK','Asia/Colombo':'LK','Asia/Kathmandu':'NP',
        'Europe/Berlin':'DE','Europe/Paris':'FR','Europe/Madrid':'ES','Europe/Rome':'IT','Europe/Amsterdam':'NL','Africa/Johannesburg':'ZA',
        'Africa/Lagos':'NG','Africa/Nairobi':'KE','Asia/Tokyo':'JP','Pacific/Auckland':'NZ','Asia/Kuala_Lumpur':'MY','Asia/Manila':'PH',
        'America/Sao_Paulo':'BR','Asia/Riyadh':'SA','Asia/Jakarta':'ID','Asia/Bangkok':'TH'
    };

    var EU_VAT = ['IE','DE','FR','ES','IT','NL','PT','BE','AT','FI','GR','SE','DK','PL'];

    // country -> [tax name, tax-ID label, default rate]
    var TAX_PROFILES = {
        IN:['GST','GSTIN',18], GB:['VAT','VAT No.',20], AU:['GST','ABN',10], NZ:['GST','GST No.',15],
        CA:['GST/HST','GST/HST No.',5], SG:['GST','GST Reg. No.',9], AE:['VAT','TRN',5], US:['Sales Tax','Tax ID',0]
    };

    function taxProfileFor(country) {
        if (TAX_PROFILES[country]) return TAX_PROFILES[country];
        if (EU_VAT.indexOf(country) !== -1) return ['VAT', 'VAT No.', 20];
        return ['Tax', 'Tax ID', 0];
    }

    function buildInfo(country, dial, cur) {
        country = (country || '').toUpperCase();
        var fb = REGION[country] || [];
        return { country: country, dial: dial || fb[0] || '', cur: cur || fb[1] || '' };
    }

    function guessFromBrowser() {
        var country = '';
        try { country = TZ_COUNTRY[Intl.DateTimeFormat().resolvedOptions().timeZone] || ''; } catch (e) {}
        if (!country) {
            var parts = (navigator.language || '').split('-');
            if (parts[1]) country = parts[1].toUpperCase();
        }
        return buildInfo(country);
    }

    function currencyInfo(code) {
        code = String(code || 'USD').toUpperCase();
        try {
            var nf = new Intl.NumberFormat('en', { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' });
            var decimals = nf.resolvedOptions().maximumFractionDigits;
            var parts = nf.formatToParts(0), symbol = code;
            for (var i = 0; i < parts.length; i++) { if (parts[i].type === 'currency') symbol = parts[i].value; }
            return {
                code: code, symbol: symbol, decimals: decimals, factor: Math.pow(10, decimals),
                locale: code === 'INR' ? 'en-IN' : (navigator.language || 'en-US')
            };
        } catch (e) {
            return { code: 'USD', symbol: '$', decimals: 2, factor: 100, locale: 'en-US' };
        }
    }

    function listCurrencies() {
        var codes;
        try { codes = Intl.supportedValuesOf('currency'); }
        catch (e) { codes = ['USD','EUR','GBP','INR','AUD','CAD','AED','SGD','JPY','CNY','CHF','ZAR','BRL','MXN','NZD','SAR','MYR','PKR','BDT','LKR','NPR','NGN','KES','EGP']; }
        var dn = null;
        try { dn = new Intl.DisplayNames(['en'], { type: 'currency' }); } catch (e) {}
        return codes.map(function (c) {
            var name = '';
            try { name = dn ? dn.of(c) : ''; } catch (e) {}
            return { code: c, label: name ? c + ' \u2013 ' + name : c };
        });
    }

    var CACHE_KEY = 'qb_geo', CACHE_MS = 24 * 3600 * 1000;
    function readCache() {
        try {
            var c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
            if (c && c.info && (Date.now() - c.ts) < CACHE_MS) return c.info;
        } catch (e) {}
        return null;
    }
    function writeCache(info) {
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), info: info })); } catch (e) {}
    }

    /**
     * detect(callback): calls callback(info, source) up to two times.
     *   1st: instant guess from browser timezone/language (source 'browser')
     *   2nd: IP-based result (source 'ip') or cached result (source 'cache')
     * info = { country: 'IN', dial: '+91', cur: 'INR' }
     */
    function detect(callback) {
        try { callback(guessFromBrowser(), 'browser'); } catch (e) { console.error(e); }

        var cached = readCache();
        if (cached) {
            try { callback(cached, 'cache'); } catch (e) { console.error(e); }
            return Promise.resolve();
        }
        if (typeof fetch !== 'function') return Promise.resolve();

        var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
        var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 4000);

        return fetch('https://ipapi.co/json/', ctrl ? { signal: ctrl.signal } : {})
            .then(function (r) { if (!r.ok) throw new Error('lookup failed'); return r.json(); })
            .then(function (j) {
                clearTimeout(timer);
                if (!j || j.error || !j.country_code) throw new Error('lookup error');
                var info = buildInfo(j.country_code, j.country_calling_code, j.currency);
                writeCache(info);
                callback(info, 'ip');
            })
            .catch(function () { clearTimeout(timer); /* keep the browser-based guess */ });
    }

    global.QBGeo = {
        detect: detect,
        currencyInfo: currencyInfo,
        listCurrencies: listCurrencies,
        taxProfileFor: taxProfileFor
    };
})(window);
