# ScamShield — Devpost submission text

**Tagline (short description):**
Paste any suspicious message to get an explained risk score, highlighted red flags and look-alike link detection. Works in English and Vietnamese, entirely on your device.

---

## Inspiration
My family group chat gets a "your account is locked" or "you won a prize" message almost every week. Older relatives can't always tell whether it's real, and they're too embarrassed to ask. In Vietnam, fake police and fake bank calls have cost people their life savings. Existing tools only block or label a message and never explain why, so the next scam still works. I wanted a tool that **teaches the tactic** while it checks the message, and that is private enough to trust with a real bank message.

## What it does
ScamShield gives you an explained risk report in under a second for any SMS, email or chat message you paste:

- **0–100 risk score** and a verdict, plus the scam type: phishing, OTP/account takeover, fake delivery, prize bait, task/job scam, investment/crypto, government/police impersonation, tech support or payment fraud.
- **Annotated message:** each red flag is highlighted inside the original text. Hover or tap one to see the manipulation tactic in plain language.
- **Link inspector:** catches look-alike domains (`paypa1`, `amaz0n`, `netfilx`), brand names hidden in sub-domains (`paypal.com.account-check.xyz`), punycode, raw IP addresses, shorteners, abused TLDs, `@` tricks, direct `.apk` downloads and fake government domains.
- **Combination boosts:** dangerous pairs such as *link + password request* or *secrecy + money* raise the score.
- **What to do now:** three steps tailored to the scam type, and a **Copy safety report** button for warning family members.
- **Bilingual:** English and Vietnamese. Text written with or without accents is matched.
- **Train your eye:** a quiz where you decide whether a message is a scam or legit, and the engine then shows what gave it away.
- **100% on-device:** no server, no account, no tracking, no AI API. It works offline.

## How I built it
- **Plain HTML, CSS and JavaScript** with no framework or build step, so it loads instantly and anyone can host it on GitHub Pages.
- **A custom, explainable rule engine** (`src/engine.js`):
  - Unicode NFC normalisation plus a per-character diacritic fold that keeps a **1:1 index mapping** with the original text, so matches can be highlighted exactly where the user typed them.
  - **48 bilingual regex patterns** grouped into 13 manipulation tactics, each carrying a weight and a human-readable explanation.
  - **URL analyser:** leet-speak decoding and **optimal-string-alignment (Damerau) edit distance** against official brand domains, registrable-domain extraction (including `com.vn` and `co.uk`), and shortener, IP, punycode and TLD heuristics.
  - **Scoring:** diminishing returns per rule (1, 0.6, 0.3), combination boosts, and an exponential squash to 0–100. A safety notice ("we will never ask for your password") cancels the secret-request rule to avoid false alarms.
  - A **classifier** maps the detected tactics to a scam type and tailored advice.
- **Unit tests** with Node's built-in `node:test` cover every quiz message, look-alike domains, official domains, index mapping and score bounds.
- **Automated demo video:** a Playwright script drives the app and captures 1080p frames through the Chrome DevTools screencast. Windows text-to-speech generates the narration and ffmpeg assembles the result, with each scene timed to its narration segment.

## Challenges I ran into
- **Highlighting Vietnamese text.** Stripping accents normally changes string length, which breaks highlight positions. I fold one character at a time, so every index in the folded string maps back to the same character in the original.
- **Avoiding false alarms.** Real messages also mention passwords ("we'll never ask for your password") and brands (Netflix receipts). Safety signals, a trust bonus for official domains and combination-based scoring keep legitimate messages near zero.
- **Typosquats like `netfilx`.** Plain Levenshtein distance scores a swap of two letters as two edits. Switching to optimal-string-alignment distance counts it as one.
- **Balancing the score.** Simply adding up rule weights meant a long message with many weak signals beat a short message with one deadly signal. Per-rule diminishing returns and the exponential squash fixed that.

## Accomplishments that I'm proud of
- Every verdict is **explainable**. The user always sees *why*, so each check also teaches them something.
- It handles **real Vietnamese scam scripts**, written with or without accents, and correctly identifies a fake-police message with a malicious `.apk` link.
- All 14 sample and quiz messages are classified correctly, and the test suite passes.
- It's fully private and offline, and still feels instant and polished.

## What I learned
- How scammers structure messages: the same handful of tactics (fear, urgency, authority, secrecy, easy money) appear across languages and channels.
- Unicode normalisation details, edit-distance variants, and how registrable domains work.
- How to automate a narrated product demo with Playwright, CDP screencasting and ffmpeg.

## What's next for ScamShield
- A **browser extension** that checks Gmail and Outlook messages in place.
- An **Android share target**, so a suspicious SMS can be shared to ScamShield in one tap.
- **More languages**, starting with Spanish, Hindi, Indonesian and Tagalog.
- An opt-in, community-reported domain blocklist, while keeping the core engine offline.

## Built with
`javascript` `html5` `css3` `node.js` `node:test` `playwright` `ffmpeg` `github-pages` `claude-code`
