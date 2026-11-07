/*
 * ScamShield detection engine
 * Runs 100% locally. No network calls, no data leaves the device.
 * Works in the browser (window.ScamShield) and in Node (module.exports).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ScamShield = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Text normalisation: lowercase + strip Vietnamese / Latin diacritics while
  // keeping a 1:1 index mapping with the (NFC) original, so matches can be
  // highlighted in the text the user actually typed.
  // ---------------------------------------------------------------------------
  const MARKS = /[̀-ͯ]/g;
  function foldChar(c) {
    if (c === 'đ' || c === 'Đ') return 'd';
    const f = c.normalize('NFD').replace(MARKS, '').toLowerCase();
    return f.length === 1 ? f : c.toLowerCase().charAt(0) || c;
  }
  function fold(text) {
    let out = '';
    for (let i = 0; i < text.length; i++) out += foldChar(text[i]);
    return out;
  }

  // ---------------------------------------------------------------------------
  // Categories & content rules (English + Vietnamese, matched on folded text)
  // ---------------------------------------------------------------------------
  const CATEGORIES = {
    urgency:      { label: 'Pressure & urgency',      color: '#f59e0b' },
    threat:       { label: 'Threats & fear',          color: '#ef4444' },
    credential:   { label: 'Asks for secrets',        color: '#dc2626' },
    money:        { label: 'Money request',           color: '#f97316' },
    untraceable:  { label: 'Untraceable payment',     color: '#b91c1c' },
    prize:        { label: 'Too good to be true',     color: '#a855f7' },
    job:          { label: 'Easy-money job',          color: '#8b5cf6' },
    impersonation:{ label: 'Claims to be official',   color: '#3b82f6' },
    secrecy:      { label: 'Isolation & secrecy',     color: '#ec4899' },
    generic:      { label: 'Generic greeting',        color: '#64748b' },
    remote:       { label: 'Remote access / app install', color: '#e11d48' },
    delivery:     { label: 'Parcel problem',          color: '#0ea5e9' },
    investment:   { label: 'Guaranteed returns',      color: '#d946ef' },
    link:         { label: 'Risky link',              color: '#dc2626' },
    trust:        { label: 'Safety signal',           color: '#16a34a' }
  };

  const R = (category, weight, why, patterns) => ({ category, weight, why, patterns });

  const RULES = [
    R('urgency', 12, 'Scammers rush you so you act before you think.', [
      /\b(urgent(ly)?|immediately|right away|act now|asap|final (notice|warning|reminder))\b/g,
      /\bwithin (24|48|12|2|1) ?(hours?|hrs?|h|minutes?|mins?)\b/g,
      /\b(expires?|expiring|ends?) (today|tonight|soon|in \d+)/g,
      /\blast chance\b|\bdo not ignore\b|\btime[- ]sensitive\b/g,
      /\b(khan cap|ngay lap tuc|gap|trong vong \d+ ?(h|gio|phut)|het han|lan cuoi)\b/g
    ]),
    R('threat', 16, 'Threats of locked accounts, fines or arrest are classic fear tactics.', [
      /\b(account|card|service|number)\b.{0,30}\b(will be|has been|is) (suspended|locked|blocked|closed|terminated|disabled|deactivated)/g,
      /\b(suspended|locked|blocked|frozen|deactivated) (account|card)\b/g,
      /\b(legal action|lawsuit|arrest(ed)?|warrant|police|penalty|fined?|prosecut\w*|court)\b/g,
      /\b(bi khoa|khoa tai khoan|tam khoa|vo hieu hoa|cong an|khoi to|bat giu|truy na|phat tien|rua tien|toa an)\b/g
    ]),
    R('credential', 22, 'Real organisations never ask for passwords, PINs or one-time codes by message.', [
      /\b(verify|confirm|update|validate|re-?activate)\b.{0,25}\b(account|identity|details|information|password|login|card)\b/g,
      /\b(password|passcode|pin( code)?|cvv|cvc|security code|one[- ]time (code|password)|otp|2fa code|verification code|login details|seed phrase|recovery phrase|social security|ssn)\b/g,
      /\b(mat khau|ma otp|ma xac (thuc|nhan|minh)|xac minh|xac thuc|cccd|can cuoc|so the|ma pin)\b/g
    ]),
    R('credential', 30, 'Anyone asking you to share or read out a code is trying to take over your account.', [
      /\b(send|share|give|provide|tell|read|forward|reply with)\b.{0,40}\b(code|otp|pin)\b/g,
      /\b(cung cap|gui|doc|nhan tin)\b.{0,20}\b(ma|otp)\b/g
    ]),
    R('money', 12, 'Unexpected requests to pay or transfer money are a major red flag.', [
      /\b(wire|transfer|send) (the )?(money|funds|payment|\$|usd)/g,
      /\b(processing|release|clearance|customs|delivery|redelivery|unlock|registration|activation) fee\b/g,
      /\bpay (a|the|small)\b.{0,15}\b(fee|deposit|charge)\b/g,
      /\b(chuyen khoan|nap tien|dong phi|phi (xu ly|giao hang|kich hoat|thong quan)|dat coc|chuyen tien)\b/g
    ]),
    R('untraceable', 24, 'Gift cards and crypto are untraceable – legitimate businesses don\'t demand them.', [
      /\b(gift ?cards?|itunes|google play (card|code)|steam card|amazon card)\b/g,
      /\b(bitcoin|btc|usdt|crypto(currency)?|wallet address|binance|western union|moneygram)\b/g,
      /\b(the cao|tien ao|vi dien tu la)\b/g
    ]),
    R('prize', 16, 'Winning a prize you never entered for is almost always bait.', [
      /\b(you('ve| have)? won|you are (the|a|our) (lucky )?winner|congratulations|lottery|jackpot|sweepstakes)\b/g,
      /\bclaim (your|the) (prize|reward|gift|refund|money)\b/g,
      /\b(free (iphone|gift|money)|selected to receive)\b/g,
      /\b(trung thuong|chuc mung|qua tang|nhan thuong|tri an khach hang|giai thuong)\b/g
    ]),
    R('job', 20, 'High pay for little work (liking videos, rating products) is the hook of task scams.', [
      /\bearn \$?\d[\d,.]*\s?(k|usd|\$)?.{0,15}\b(per|a|each|every) (day|hour|task|week)\b/g,
      /\b(work from home|no experience (needed|required)|part[- ]time job|simple tasks?|like (videos|posts)|rate products)\b/g,
      /\b(viec nhe luong cao|cong tac vien|lam tai nha|hoa hong|thu nhap \d|nhiem vu|like video|tha tim)\b/g,
      /\b(contact|message|text|add) (us|me) on (whatsapp|telegram|zalo|signal)\b/g
    ]),
    R('impersonation', 8, 'Mentions a bank, brand or agency – check it really comes from them.', [
      /\b(bank|paypal|amazon|apple|icloud|microsoft|netflix|irs|hmrc|social security administration|fedex|dhl|usps|ups|royal mail|facebook|meta|instagram|whatsapp|google|tax (office|department))\b/g,
      /\b(vietcombank|techcombank|bidv|agribank|vietinbank|vpbank|mb ?bank|tpbank|sacombank|acb|momo|zalopay|vnpay|shopee|lazada|tiki|vnpost|viettel post|giao hang (nhanh|tiet kiem)|evn|dien luc|bo cong an|ngan hang|thue|bhxh|bao hiem xa hoi)\b/g
    ]),
    R('secrecy', 16, 'Telling you to keep it secret cuts you off from people who would warn you.', [
      /\b(don'?t|do not) (tell|share this with|inform)\b|\bkeep (this|it) (secret|confidential|between us)\b/g,
      /\b(bi mat|khong (duoc )?(noi|ke) (voi|cho) ai)\b/g
    ]),
    R('generic', 6, 'A generic greeting means they don\'t actually know who you are.', [
      /\b(dear (customer|user|client|member|account holder|sir\/madam|friend|valued customer))\b/g,
      /\b(quy khach( hang)?|khach hang than men)\b/g
    ]),
    R('remote', 26, 'Installing remote-access tools or unknown apps hands over control of your device.', [
      /\b(anydesk|teamviewer|rustdesk|quick ?support|ultraviewer)\b/g,
      /\b(download|install)\b.{0,20}\b(app|apk|application|software)\b/g,
      /\.apk\b/g,
      /\b(cai dat|tai) (ung dung|app)\b/g
    ]),
    R('delivery', 12, 'Fake "failed delivery" notices are one of the most common SMS scams.', [
      /\b(package|parcel|shipment|delivery|order)\b.{0,30}\b(could not|couldn'?t|cannot|was not|unable to) be delivered\b/g,
      /\b(redelivery|reschedule (your )?delivery|held at (customs|our depot)|incomplete (address|information))\b/g,
      /\b(don hang|buu pham|buu kien)\b.{0,25}\b(that bai|bi giu|chua giao|khong giao duoc)\b/g
    ]),
    R('investment', 18, 'Nobody can guarantee investment profits – that promise is the scam.', [
      /\b(guaranteed|risk[- ]free) (returns?|profits?|income)\b/g,
      /\b(double|triple) your (money|investment)\b/g,
      /\b\d{2,4} ?% (profit|return|daily|weekly|monthly)\b/g,
      /\b(loi nhuan (dam bao|cao)|khong rui ro|dau tu (sinh loi|chac thang)|x2 tai khoan)\b/g
    ]),
    R('trust', -10, 'Contains a common legitimate safety reminder.', [
      /\b(we|bank|company) (will )?never ask (you )?(for|to)\b/g,
      /\b(khong bao gio yeu cau)\b/g
    ])
  ];

  // ---------------------------------------------------------------------------
  // URL analysis
  // ---------------------------------------------------------------------------
  const OFFICIAL = {
    paypal: ['paypal.com'], amazon: ['amazon.com', 'amazon.co.uk', 'amazon.de'], apple: ['apple.com', 'icloud.com'],
    microsoft: ['microsoft.com', 'live.com', 'outlook.com', 'office.com'], google: ['google.com', 'gmail.com', 'youtube.com'],
    netflix: ['netflix.com'], facebook: ['facebook.com', 'fb.com'], instagram: ['instagram.com'], whatsapp: ['whatsapp.com'],
    dhl: ['dhl.com'], fedex: ['fedex.com'], usps: ['usps.com'], ups: ['ups.com'], irs: ['irs.gov'], chase: ['chase.com'],
    wellsfargo: ['wellsfargo.com'], bankofamerica: ['bankofamerica.com'], coinbase: ['coinbase.com'], binance: ['binance.com'],
    vietcombank: ['vietcombank.com.vn'], techcombank: ['techcombank.com', 'techcombank.com.vn'], bidv: ['bidv.com.vn'],
    agribank: ['agribank.com.vn'], vietinbank: ['vietinbank.vn'], vpbank: ['vpbank.com.vn'], momo: ['momo.vn'],
    shopee: ['shopee.vn', 'shopee.com'], lazada: ['lazada.vn', 'lazada.com'], vnpost: ['vnpost.vn'], zalopay: ['zalopay.vn']
  };
  const SHORTENERS = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'is.gd', 'cutt.ly', 'rebrand.ly', 'shorturl.at', 's.id',
    'ow.ly', 'tiny.cc', 'rb.gy', 'v.gd', 'bitly.com', 't.ly', 'shorte.st', 'urlz.fr', 'lnkd.in'];
  const RISKY_TLDS = ['xyz', 'top', 'click', 'live', 'icu', 'buzz', 'cyou', 'shop', 'online', 'site', 'club', 'vip', 'rest',
    'sbs', 'cfd', 'monster', 'quest', 'work', 'support', 'tk', 'ml', 'ga', 'cf', 'gq', 'zip', 'mov', 'loan', 'win', 'bid'];
  const MULTI_PART_SUFFIX = ['co.uk', 'com.vn', 'gov.vn', 'edu.vn', 'net.vn', 'org.vn', 'com.au', 'co.jp', 'com.br', 'co.in'];

  const URL_RE = /\b((?:https?:\/\/|www\.)[^\s<>"')\]]+|(?:[a-z0-9-]+\.)+(?:[a-z]{2,24})(?:\/[^\s<>"')\]]*)?)/gi;

  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    // Optimal-string-alignment distance: Levenshtein + adjacent transpositions
    // ("netfilx" vs "netflix" = 1), a favourite typosquatting trick.
    const d = Array.from({ length: m + 1 }, (_, i) => [i]);
    for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
    return d[m][n];
  }

  function deLeet(s) {
    return s.replace(/rn/g, 'm').replace(/vv/g, 'w').replace(/0/g, 'o').replace(/1/g, 'l')
      .replace(/3/g, 'e').replace(/5/g, 's').replace(/4/g, 'a').replace(/7/g, 't').replace(/\$/g, 's');
  }

  function registrable(host) {
    const parts = host.split('.');
    const last2 = parts.slice(-2).join('.');
    if (MULTI_PART_SUFFIX.includes(last2) && parts.length >= 3) return parts.slice(-3).join('.');
    return last2;
  }

  function isOfficial(host) {
    for (const brand in OFFICIAL) {
      for (const d of OFFICIAL[brand]) if (host === d || host.endsWith('.' + d)) return brand;
    }
    return null;
  }

  function analyzeUrl(raw) {
    const findings = [];
    let s = raw.replace(/[.,;:!?]+$/, '');
    const hadScheme = /^https?:\/\//i.test(s);
    const isHttp = /^http:\/\//i.test(s);
    let rest = s.replace(/^https?:\/\//i, '');
    let userinfo = false;
    let hostPart = rest.split(/[\/?#]/)[0];
    if (hostPart.includes('@')) { userinfo = true; hostPart = hostPart.split('@').pop(); }
    let host = hostPart.replace(/:\d+$/, '').toLowerCase().replace(/^www\./, '');
    const add = (weight, text) => findings.push({ weight, text });

    const official = isOfficial(host);
    const reg = registrable(host);
    const tld = host.split('.').pop();

    if (SHORTENERS.includes(host)) add(18, 'Shortened link hides the real destination.');
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) add(28, 'Uses a raw IP address instead of a domain name.');
    if (host.includes('xn--')) add(26, 'Punycode domain – may use look-alike foreign characters.');
    if (/[^\x00-\x7f]/.test(host)) add(26, 'Domain contains non-Latin look-alike characters.');
    if (userinfo) add(24, 'Contains "@" – everything before it is ignored by the browser.');
    if (RISKY_TLDS.includes(tld)) add(14, `".${tld}" domains are cheap and heavily abused by scammers.`);
    if (isHttp) add(8, 'Not encrypted (http, not https).');
    if ((host.match(/-/g) || []).length >= 2) add(8, 'Many hyphens – typical of throw-away scam domains.');
    if (host.split('.').length >= 5) add(8, 'Unusually deep sub-domain chain.');

    if (!official) {
      const regLabel = reg.split('.')[0];
      const sub = host.slice(0, Math.max(0, host.length - reg.length - 1));
      for (const brand in OFFICIAL) {
        const offLabel = OFFICIAL[brand][0].split('.')[0];
        const cleaned = deLeet(regLabel);
        if (brand.length >= 4 && regLabel !== offLabel && cleaned === offLabel) {
          add(34, `"${reg}" imitates ${OFFICIAL[brand][0]} using swapped characters.`); break;
        }
        if (brand.length >= 5 && regLabel !== offLabel && levenshtein(cleaned, offLabel) === 1) {
          add(30, `"${reg}" is one letter away from ${OFFICIAL[brand][0]}.`); break;
        }
        if (brand.length >= 3 && regLabel !== offLabel && new RegExp('(^|[^a-z])' + brand + '|' + brand + '([^a-z]|$)').test(cleaned)) {
          if (cleaned !== regLabel && !new RegExp(brand).test(regLabel)) add(34, `"${reg}" imitates ${OFFICIAL[brand][0]} using swapped characters (e.g. 1 for l).`);
          else add(28, `Uses the name "${brand}" but is not ${OFFICIAL[brand][0]}.`);
          break;
        }
        if (brand.length >= 4 && new RegExp('(^|\\.|-)' + brand + '(\\.|-|$)').test(sub)) {
          add(30, `"${brand}" appears only in the sub-domain – the real site is ${reg}.`); break;
        }
      }
    }
    if (/(login|verify|secure|account|update|confirm|signin|wallet|support|xac-?minh|bao-?mat)/.test(host) && !official) {
      add(10, 'Domain uses security words like "login" or "verify" to look trustworthy.');
    }
    if (/\.(apk|exe|scr|msi|bat|jar)(\?|#|$)/i.test(rest)) add(26, 'Link downloads an app/program file directly – a common way to install spyware.');
    if (/(bocongan|congan|dichvucong|chinhphu|baohiemxahoi|bhxh|tongcucthue|gov|irs|government|police)/.test(host) && !/\.gov(\.[a-z]{2})?$/.test(host)) {
      add(24, `Pretends to be a government site, but real government sites end in .gov / .gov.vn.`);
    }
    if (official && findings.length === 0) add(-12, `Matches the official ${official} domain.`);

    const score = findings.reduce((a, f) => a + f.weight, 0);
    return { raw: s, host, registrable: reg, official, hadScheme, findings, score };
  }

  // ---------------------------------------------------------------------------
  // Scam type classification & advice
  // ---------------------------------------------------------------------------
  const TYPES = {
    otp:        { name: 'Account takeover (OTP theft)', advice: ['Never share a one-time code with anyone – not even "bank staff".', 'If you already shared it, call your bank on the number printed on your card right now.', 'Change your password and enable app-based 2FA.'] },
    phishing:   { name: 'Phishing / credential theft', advice: ['Do not click the link. Open the official app or type the website address yourself.', 'Never enter passwords or card numbers from a message link.', 'Report the message as phishing and delete it.'] },
    delivery:   { name: 'Fake delivery notice', advice: ['Track parcels only in the courier\'s official app or website.', 'Couriers don\'t ask for small "redelivery fees" via SMS links.', 'Delete the message; don\'t reply.'] },
    prize:      { name: 'Prize / lottery bait', advice: ['You cannot win a contest you never entered.', 'Real prizes never require a fee or your bank details.', 'Ignore and block the sender.'] },
    job:        { name: 'Task / job scam', advice: ['Legit jobs don\'t pay you to like videos or require deposits.', 'Never "top up" money to unlock earnings – you won\'t get it back.', 'Report the recruiter account to the platform.'] },
    investment: { name: 'Investment / crypto scam', advice: ['No real investment guarantees profit.', 'Check the company with your financial regulator before sending anything.', 'Be extra careful if you met the person online recently.'] },
    authority:  { name: 'Government / police impersonation', advice: ['Police and tax offices never demand payment or transfers by phone or chat.', 'Hang up and call the agency\'s official number yourself.', 'Talk to someone you trust before acting.'] },
    tech:       { name: 'Tech-support / remote-access scam', advice: ['Never install AnyDesk, TeamViewer or unknown APKs at a stranger\'s request.', 'If you did, disconnect from the internet and uninstall it.', 'Have a trusted person check your device and bank accounts.'] },
    money:      { name: 'Payment fraud', advice: ['Verify any payment request through a separate, known channel.', 'Never pay with gift cards or crypto to someone you don\'t know.', 'When in doubt, wait – real deadlines can survive a phone call.'] },
    none:       { name: 'No clear scam pattern', advice: ['Nothing obviously malicious was found, but stay alert.', 'If you don\'t know the sender, verify through an official channel.', 'Never share codes or passwords, no matter how genuine a message looks.'] }
  };

  function classify(cat, urlScore) {
    const has = (c, min = 1) => (cat[c] || 0) >= min;
    if (has('credential') && cat._otp) return 'otp';
    if (has('threat') && /police|arrest|warrant|cong an|khoi to|bat giu|truy na|court|toa an|irs|thue|rua tien|back taxes/.test(cat._text || '')) return 'authority';
    if (has('remote')) return 'tech';
    if (has('investment')) return 'investment';
    if (has('job')) return 'job';
    if (has('delivery')) return 'delivery';
    if (has('prize')) return 'prize';
    if (has('untraceable') && /bitcoin|btc|usdt|crypto|binance|tien ao/.test(cat._text || '')) return 'investment';
    if (has('credential') || (urlScore >= 25 && has('impersonation'))) return 'phishing';
    if (has('money') || has('untraceable')) return 'money';
    return null;
  }

  // ---------------------------------------------------------------------------
  // Main analysis
  // ---------------------------------------------------------------------------
  function analyze(input) {
    const text = (input || '').normalize('NFC');
    const folded = fold(text);
    const matches = [];

    RULES.forEach((rule, ri) => {
      rule.patterns.forEach(re => {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(folded)) !== null) {
          if (m[0].length === 0) { re.lastIndex++; continue; }
          matches.push({ start: m.index, end: m.index + m[0].length, category: rule.category, weight: rule.weight,
            why: rule.why, rule: ri, text: text.slice(m.index, m.index + m[0].length) });
        }
      });
    });

    // A safety reminder ("we will never ask for your password") neutralises the
    // secret-word mentions right after it.
    const trusts = matches.filter(m => m.category === 'trust');
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i];
      if (m.category === 'credential' && trusts.some(t => m.start >= t.start && m.start - t.end < 40)) matches.splice(i, 1);
    }

    // URLs
    const urls = [];
    URL_RE.lastIndex = 0;
    let um;
    while ((um = URL_RE.exec(text)) !== null) {
      const raw = um[0];
      if (/^[\d.]+$/.test(raw) && !/^\d{1,3}(\.\d{1,3}){3}/.test(raw)) continue;
      if (!/^(https?:\/\/|www\.)/i.test(raw)) {
        const tld = raw.split(/[\/?#]/)[0].split('.').pop().toLowerCase();
        if (tld.length < 2 || /^(i\.e|e\.g|etc)$/.test(raw.toLowerCase())) continue;
        if (!/^(com|net|org|info|io|co|vn|uk|me|ly|gl|gd|at|id|in|us|biz|app|dev|gov|edu|cc|tk|ml|ga|cf|gq|ru|cn|de|fr|au|jp|br)$/.test(tld) && !RISKY_TLDS.includes(tld)) continue;
      }
      const res = analyzeUrl(raw);
      res.start = um.index; res.end = um.index + res.raw.length;
      urls.push(res);
      if (res.score > 0) {
        matches.push({ start: res.start, end: res.end, category: 'link', weight: 0, why: res.findings.map(f => f.text).join(' '),
          text: res.raw, url: true });
      }
    }

    // Count each rule at most twice (diminishing returns) and each category with decay
    const perRule = {};
    const catWeights = {};
    for (const m of matches.filter(m => !m.url).sort((a, b) => a.start - b.start)) {
      perRule[m.rule] = (perRule[m.rule] || 0) + 1;
      if (perRule[m.rule] > 3) continue;
      const factor = [0, 1, 0.6, 0.3][perRule[m.rule]];
      catWeights[m.category] = (catWeights[m.category] || 0) + m.weight * factor;
    }
    const catCount = {};
    matches.forEach(m => { catCount[m.category] = (catCount[m.category] || 0) + 1; });

    const urlScore = urls.reduce((mx, u) => Math.max(mx, u.score), 0);
    let raw = Object.values(catWeights).reduce((a, b) => a + b, 0) + Math.max(0, urlScore);
    if (urls.length && urlScore < 0) raw += urlScore;

    // Combination boosts – patterns that are far more dangerous together
    const combos = [];
    const has = c => (catWeights[c] || 0) > 0;
    const boost = (cond, pts, label) => { if (cond) { raw += pts; combos.push(label); } };
    boost(urls.length > 0 && has('credential'), 14, 'Link + request for account details');
    boost(has('urgency') && (has('money') || has('untraceable')), 12, 'Urgency + payment demand');
    boost(has('impersonation') && urlScore >= 20, 12, 'Brand name + suspicious link');
    boost(has('threat') && has('urgency'), 8, 'Threat + deadline');
    boost(has('secrecy') && (has('money') || has('untraceable')), 12, 'Secrecy + money');

    const score = Math.max(0, Math.min(100, Math.round(100 * (1 - Math.exp(-Math.max(0, raw) / 45)))));
    const level = score >= 60 ? 'high' : score >= 25 ? 'medium' : 'low';

    const otp = matches.some(m => m.rule === 3 || (/\b(otp|ma xac|one[- ]time)/.test(fold(m.text)) && m.category === 'credential'));
    const typeKey = classify(Object.assign({ _text: folded, _otp: otp }, catCount), urlScore) || (level === 'low' ? 'none' : 'money');

    const categories = Object.keys(catCount).filter(c => c !== 'link' || urlScore > 0).map(c => ({
      id: c, label: CATEGORIES[c].label, color: CATEGORIES[c].color, count: catCount[c],
      why: (matches.find(m => m.category === c) || {}).why,
      examples: [...new Set(matches.filter(m => m.category === c).map(m => m.text.trim()))].slice(0, 4)
    })).sort((a, b) => (catWeights[b.id] || urlScore) - (catWeights[a.id] || urlScore));

    return {
      score, level, raw: Math.round(raw),
      type: { key: typeKey, name: TYPES[typeKey].name, advice: TYPES[typeKey].advice },
      matches: resolveOverlaps(matches),
      categories, urls, combos, length: text.length, text
    };
  }

  // Keep non-overlapping highlight spans, preferring links and heavier rules.
  function resolveOverlaps(matches) {
    const sorted = [...matches].sort((a, b) => (!!b.url - !!a.url) || (b.weight - a.weight) || ((b.end - b.start) - (a.end - a.start)));
    const taken = [];
    for (const m of sorted) {
      if (!taken.some(t => m.start < t.end && t.start < m.end)) taken.push(m);
    }
    return taken.sort((a, b) => a.start - b.start);
  }

  const ruleCount = RULES.reduce((n, r) => n + r.patterns.length, 0);
  return { analyze, analyzeUrl, fold, levenshtein, CATEGORIES, TYPES, ruleCount, version: '1.0.0' };
});
