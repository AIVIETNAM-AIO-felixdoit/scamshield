(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ScamSamples = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const EXAMPLES = [
    { id: 'bank', label: 'Bank alert', icon: '🏦',
      text: 'URGENT: Dear customer, your PayPal account has been suspended due to unusual activity. Verify your account within 24 hours to avoid permanent closure: http://paypa1-secure-login.xyz/verify' },
    { id: 'parcel', label: 'Parcel SMS', icon: '📦',
      text: 'USPS: Your package could not be delivered due to an incomplete address. Pay the $1.99 redelivery fee here: https://bit.ly/3usps-redeliver' },
    { id: 'otp', label: 'OTP call script', icon: '🔐',
      text: 'Hi, this is the fraud team from your bank. We blocked a suspicious payment. To cancel it, please read me the 6-digit verification code we just sent to your phone. Do not share this with anyone else.' },
    { id: 'job', label: 'Easy job', icon: '💼',
      text: 'Hello! Our company is hiring part-time staff. Work from home, no experience needed. Earn $300 per day just by liking videos. Contact us on WhatsApp to start your first simple task!' },
    { id: 'vi', label: 'Tiếng Việt', icon: '🇻🇳',
      text: 'Bộ Công An thông báo: tài khoản ngân hàng của quý khách liên quan đến đường dây rửa tiền và sẽ bị khóa. Yêu cầu quý khách cài đặt ứng dụng tại dichvucong-bocongan.top/app.apk và chuyển khoản xác minh ngay lập tức. Giữ bí mật, không được nói với ai.' },
    { id: 'legit', label: 'Real message', icon: '✅',
      text: 'Hi Sam, just a reminder that our team meeting moved to Thursday at 3pm in room 204. The agenda is on the shared drive. See you there!' }
  ];

  const QUIZ = [
    { scam: true,  from: '+1 (202) 555-0147', text: 'Apple ID: your account was locked for security reasons. Confirm your details at apple-id-support.click to restore access.' },
    { scam: false, from: 'Mom', text: 'Landed safely! Grandma says hi. Call me when you finish class tonight.' },
    { scam: true,  from: 'Recruiter Linda', text: 'Congratulations, you are selected! Earn 500 USD a day rating products. Just pay a small activation fee in USDT to unlock your account.' },
    { scam: false, from: 'Netflix', text: 'Your monthly receipt is available in your account settings at netflix.com. We will never ask for your password by email.' },
    { scam: true,  from: 'IRS Notice', text: 'FINAL NOTICE: You owe back taxes. A warrant for your arrest will be issued today unless you pay with Google Play gift cards. Keep this confidential.' },
    { scam: true,  from: 'DHL Express', text: 'Your parcel is held at customs. Release fee: $2.50. Pay now: http://203.0.113.42/dhl/pay' },
    { scam: false, from: 'Library', text: 'The book you reserved, "Clean Code", is ready for pickup at the front desk until Friday.' },
    { scam: true,  from: 'Crypto Mentor', text: 'Join my VIP group! Guaranteed returns of 30% weekly, risk-free. Double your money in 2 weeks. Send BTC to my wallet address to start.' }
  ];

  return { EXAMPLES, QUIZ };
});
