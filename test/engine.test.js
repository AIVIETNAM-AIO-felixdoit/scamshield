const test = require('node:test');
const assert = require('node:assert');
const E = require('../src/engine.js');
const { EXAMPLES, QUIZ } = require('../src/samples.js');

test('every quiz message is classified correctly', () => {
  for (const q of QUIZ) {
    const r = E.analyze(q.text);
    assert.strictEqual(r.level !== 'low', q.scam, `${q.from}: score ${r.score}`);
  }
});

test('legit example scores low', () => {
  assert.strictEqual(E.analyze(EXAMPLES.find(e => e.id === 'legit').text).level, 'low');
});

test('all scam examples score high', () => {
  for (const e of EXAMPLES.filter(e => e.id !== 'legit')) assert.strictEqual(E.analyze(e.text).level, 'high', e.id);
});

test('diacritic folding keeps a 1:1 index mapping', () => {
  const s = 'Tài khoản bị khóa, đừng chuyển khoản';
  assert.strictEqual(E.fold(s).length, s.length);
  assert.strictEqual(E.fold(s), 'tai khoan bi khoa, dung chuyen khoan');
});

test('highlight spans point at the original text', () => {
  const r = E.analyze('Quý khách vui lòng cung cấp mã OTP ngay lập tức');
  for (const m of r.matches) assert.strictEqual(r.text.slice(m.start, m.end), m.text);
  assert.strictEqual(r.type.key, 'otp');
});

test('look-alike domains', () => {
  const lk = u => E.analyzeUrl(u).findings.map(f => f.text).join(' ');
  assert.match(lk('http://paypa1.com/login'), /imitates paypal\.com/);
  assert.match(lk('https://amaz0n.com'), /imitates amazon\.com/);
  assert.match(lk('https://paypal.com.account-check.xyz'), /sub-domain/);
  assert.match(lk('https://netfilx.com'), /one letter away/);
  assert.match(lk('http://192.168.4.20/bank'), /IP address/);
  assert.match(lk('https://xn--pypal-4ve.com'), /Punycode/);
  assert.match(lk('https://bit.ly/abc'), /Shortened/);
  assert.match(lk('https://user@evil.example.com'), /@/);
});

test('official domains are trusted', () => {
  for (const u of ['https://www.paypal.com/signin', 'https://vietcombank.com.vn', 'https://accounts.google.com']) {
    const r = E.analyzeUrl(u);
    assert.ok(r.score < 0, `${u} -> ${r.score}`);
  }
});

test('safety reminder does not trigger the secrets rule', () => {
  const r = E.analyze('Reminder: we will never ask for your password or PIN.');
  assert.strictEqual(r.level, 'low');
});

test('score is bounded 0..100 and empty input is safe', () => {
  assert.strictEqual(E.analyze('').score, 0);
  const huge = EXAMPLES.map(e => e.text).join(' ').repeat(20);
  const r = E.analyze(huge);
  assert.ok(r.score >= 0 && r.score <= 100);
});
