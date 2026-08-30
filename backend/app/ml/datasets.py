"""Bundled training corpora.

FraudShield ships with its own compact, deterministic datasets so the platform
trains and works immediately after installation — no multi-gigabyte download,
no external API key.

* URLs are generated from realistic benign/phishing grammars with a fixed seed.
* Messages are a hand-curated bilingual (English / Indian-English) corpus of
  scam and legitimate SMS-style texts.
"""

from __future__ import annotations

import random

# --- URL corpus ---------------------------------------------------------------

_BENIGN_DOMAINS: tuple[str, ...] = (
    "google.com",
    "github.com",
    "stackoverflow.com",
    "wikipedia.org",
    "python.org",
    "reactjs.org",
    "fastapi.tiangolo.com",
    "microsoft.com",
    "amazon.in",
    "flipkart.com",
    "nytimes.com",
    "bbc.co.uk",
    "medium.com",
    "linkedin.com",
    "developer.mozilla.org",
    "npmjs.com",
    "pypi.org",
    "kaggle.com",
    "coursera.org",
    "udemy.com",
    "irctc.co.in",
    "nic.in",
    "sbi.co.in",
    "hdfcbank.com",
    "icicibank.com",
    "paytm.com",
    "zomato.com",
    "swiggy.com",
    "cricbuzz.com",
    "indianexpress.com",
    "docs.djangoproject.com",
    "tailwindcss.com",
    "vitejs.dev",
    "scikit-learn.org",
    "nodejs.org",
    "cloudflare.com",
    "digitalocean.com",
    "atlassian.com",
    "notion.so",
    "figma.com",
)

_BENIGN_PATHS: tuple[str, ...] = (
    "",
    "/",
    "/about",
    "/pricing",
    "/docs/getting-started",
    "/blog/2024/release-notes",
    "/search?q=machine+learning",
    "/products/electronics",
    "/user/profile",
    "/help/contact-us",
    "/api/v1/status",
    "/careers",
    "/articles/how-transformers-work",
    "/downloads/latest",
    "/community/forum",
    "/en-us/library/overview",
    "/questions/1234567/how-to-use-python",
    "/watch?v=abcdEFGH",
    "/orders/history",
    "/settings/notifications",
)

_PHISH_HOST_PREFIXES: tuple[str, ...] = (
    "secure-login",
    "account-verify",
    "verify-account",
    "signin-update",
    "login-secure",
    "customer-support",
    "security-alert",
    "billing-update",
    "kyc-update",
    "netbanking-verify",
    "wallet-recovery",
    "confirm-payment",
    "free-gift-claim",
    "prize-winner-claim",
    "otp-verification",
    "unlock-account",
    "password-reset-secure",
    "refund-department",
)

_PHISH_BRANDS: tuple[str, ...] = (
    "paypal",
    "apple-id",
    "microsoft365",
    "netflix",
    "amazon",
    "hdfc-netbanking",
    "icici-bank",
    "sbi-online",
    "paytm-wallet",
    "phonepe",
    "binance",
    "coinbase-wallet",
    "metamask",
    "instagram",
    "whatsapp",
    "dhl-delivery",
)

_PHISH_TLDS: tuple[str, ...] = (
    "tk",
    "ml",
    "ga",
    "cf",
    "gq",
    "xyz",
    "top",
    "click",
    "buzz",
    "icu",
    "sbs",
    "cyou",
    "zip",
    "review",
    "work",
    "loan",
    "info",
    "online",
    "site",
)

_PHISH_PATHS: tuple[str, ...] = (
    "/login.php?account={n}&redirect=http://update.now",
    "/verify/account?token={t}&otp=required",
    "/secure/signin?user=customer{n}&password=reset",
    "/update-kyc/submit?aadhaar={n}",
    "/claim-prize?winner={n}&amount=50000",
    "/wallet/recover?seed={t}",
    "/billing/confirm-card?cvv={n}&card={n}",
    "/session/expired/reauthenticate?next=http://{t}.com",
    "/download/invoice_{n}.zip",
    "/mobile/app-update/{t}.apk",
    "/support/unlock?pin={n}",
    "/refund/claim-now?upi=user{n}@bank",
)

_SUSPICIOUS_MIDDLE = (
    "auth",
    "webscr",
    "cmd",
    "portal",
    "session",
    "validate",
    "recovery",
    "id",
    "cgi-bin",
)


def _rand_token(rng: random.Random, length: int) -> str:
    alphabet = "abcdefghijklmnopqrstuvwxyz0123456789"
    return "".join(rng.choice(alphabet) for _ in range(length))


def _benign_url(rng: random.Random) -> str:
    domain = rng.choice(_BENIGN_DOMAINS)
    path = rng.choice(_BENIGN_PATHS)
    scheme = "https" if rng.random() < 0.93 else "http"
    prefix = "www." if rng.random() < 0.35 and domain.count(".") == 1 else ""
    return f"{scheme}://{prefix}{domain}{path}"


def _phishing_url(rng: random.Random) -> str:
    style = rng.random()
    scheme = "http" if rng.random() < 0.72 else "https"

    if style < 0.18:
        # Raw IP host, a classic credential-harvesting pattern.
        host = f"{rng.randint(11, 223)}.{rng.randint(0, 255)}.{rng.randint(0, 255)}.{rng.randint(2, 254)}"
        if rng.random() < 0.3:
            host = f"{host}:{rng.choice([8080, 8443, 8000, 2095])}"
        path = rng.choice(_PHISH_PATHS)
    elif style < 0.42:
        # Brand name pushed into a subdomain of an unrelated domain.
        brand = rng.choice(_PHISH_BRANDS)
        host = (
            f"{brand}.{rng.choice(_PHISH_HOST_PREFIXES)}."
            f"{_rand_token(rng, rng.randint(6, 12))}.{rng.choice(_PHISH_TLDS)}"
        )
        path = rng.choice(_PHISH_PATHS)
    elif style < 0.66:
        # Long hyphenated credential-harvest host.
        host = (
            f"{rng.choice(_PHISH_HOST_PREFIXES)}-{rng.choice(_SUSPICIOUS_MIDDLE)}-"
            f"{rng.choice(_PHISH_BRANDS)}.{rng.choice(_PHISH_TLDS)}"
        )
        path = rng.choice(_PHISH_PATHS)
    elif style < 0.82:
        # Deep nested subdomains ending in a throwaway TLD.
        host = ".".join(
            [
                rng.choice(_PHISH_HOST_PREFIXES),
                rng.choice(_SUSPICIOUS_MIDDLE),
                _rand_token(rng, rng.randint(5, 9)),
                _rand_token(rng, rng.randint(6, 10)),
                rng.choice(_PHISH_TLDS),
            ]
        )
        path = rng.choice(_PHISH_PATHS)
    else:
        # Legitimate-looking host abused via an @-redirect or encoded payload.
        host = f"{rng.choice(_BENIGN_DOMAINS)}@{_rand_token(rng, 10)}.{rng.choice(_PHISH_TLDS)}"
        path = rng.choice(_PHISH_PATHS)

    path = path.format(n=rng.randint(1000, 99999999), t=_rand_token(rng, rng.randint(8, 22)))
    return f"{scheme}://{host}{path}"


def build_url_dataset(
    samples_per_class: int = 1400, seed: int = 42
) -> tuple[list[str], list[int]]:
    """Deterministically generate a balanced URL dataset."""
    rng = random.Random(seed)
    urls: list[str] = []
    labels: list[int] = []

    for _ in range(samples_per_class):
        urls.append(_benign_url(rng))
        labels.append(0)
    for _ in range(samples_per_class):
        urls.append(_phishing_url(rng))
        labels.append(1)

    combined = list(zip(urls, labels, strict=True))
    rng.shuffle(combined)
    urls, labels = [list(part) for part in zip(*combined, strict=True)]
    return urls, labels  # type: ignore[return-value]


# --- Message corpus -----------------------------------------------------------

SCAM_MESSAGES: tuple[str, ...] = (
    "URGENT! Your bank account will be blocked today. Verify your account immediately and share your OTP to avoid suspension.",
    "Congratulations! You have won Rs 50,000 in our lucky draw. Click the link now to claim your prize before midnight.",
    "Dear customer, your KYC is incomplete. Update KYC within 24 hours or your account will be permanently deactivated.",
    "Your debit card has been blocked due to suspicious activity. Call this number immediately and confirm your CVV.",
    "You are selected for a work from home job earning Rs 3000 per day. Pay Rs 500 registration fee to start today.",
    "Dear user your electricity connection will be disconnected tonight. Pay pending bill on this link immediately.",
    "Final reminder: your Amazon order is on hold. Verify your payment details here to release the shipment.",
    "Get guaranteed returns of 40% monthly on crypto investment. Limited slots. Send USDT now to double your money.",
    "Your income tax refund of Rs 24,570 is approved. Submit your bank account and IFSC on this link to receive it.",
    "Hi mom this is my new number, my phone broke. I urgently need money for a payment, can you transfer now?",
    "Your Netflix subscription payment failed. Update your card details within 12 hours to avoid cancellation.",
    "ALERT: unauthorised login detected on your account. Click here and enter your password to secure your account.",
    "You have won a free iPhone 15 in our anniversary contest. Pay only Rs 99 delivery charges to claim your gift.",
    "Loan approved instantly without documents. Rs 5,00,000 available. Just share Aadhaar, PAN and OTP to process.",
    "Dear user, share the 6 digit OTP received on your mobile to complete your pending refund of Rs 8,999.",
    "Your parcel is held at customs. Pay a clearance fee of Rs 250 within 6 hours or it will be returned.",
    "Attention: your SIM card will be deactivated. Complete e-KYC verification now by clicking this secure link.",
    "Invest in our IPO pre-listing offer and get assured 3x profit in 30 days. Guaranteed. No risk. Act now.",
    "Your Paytm wallet is suspended. Reactivate it here and confirm your UPI PIN to restore full access.",
    "You are the lucky winner of our lottery. To transfer your prize money we need a processing fee first.",
    "Your credit card statement shows a transaction of Rs 45,000. If not done by you, call this number and share card details.",
    "Government subsidy of Rs 15,000 approved for you. Register on this link with bank details before the deadline today.",
    "Part time job offer: earn 2000 daily by liking YouTube videos. Join our Telegram group and pay joining fee.",
    "Your WhatsApp account will be deleted in 24 hours. Verify with the 6 digit code sent to your phone.",
    "Dear customer, click here to update your net banking password. Failure to comply will freeze your account.",
    "Double your Bitcoin in 24 hours. Send 0.05 BTC to this wallet address and receive 0.1 BTC guaranteed.",
    "Urgent action required: your PAN card is not linked with Aadhaar. Pay penalty online now to avoid legal action.",
    "You have an undelivered courier. Confirm your address and pay Rs 40 redelivery charge on this link.",
    "Congratulations, your number won the KBC lottery of 25 lakh. Contact our manager on WhatsApp to claim.",
    "Your account has been credited wrongly. Send the money back immediately to this UPI ID or face legal action.",
    "Limited time offer! Free recharge for 84 days. Just forward this message to 10 friends and click the link.",
    "Immediate hiring, no interview needed. Salary 45000 per month. Send your Aadhaar copy and pay security deposit.",
    "Your Google account will be suspended for policy violation. Sign in here within 2 hours to appeal.",
    "This is the police cyber cell. A case is registered against you. Pay the settlement amount to close the case.",
    "You are pre-approved for a personal loan. Share OTP now to disburse Rs 2,00,000 to your account instantly.",
    "Insurance policy lapsed. Renew immediately by paying on this link or lose your maturity benefit of 5 lakh.",
    "Claim your prize now! You have been chosen among 100 winners. Reply with your full name and bank account.",
    "Warning: your mobile number will be blocked by TRAI. Verify identity by sharing OTP with our executive.",
    "Earn from home with online trading bot. 100% profit guaranteed daily. Deposit minimum 5000 to activate.",
    "Your Aadhaar has been used for a fraudulent transaction. Freeze it now by entering details on this portal.",
    "Hello, I am a lawyer handling a large unclaimed inheritance in your name. Send your bank details to receive funds.",
    "Act now! Only 2 slots left for the guaranteed government job scheme. Pay the processing charge today.",
    "Your Flipkart big billion reward of Rs 10,000 is pending. Spin the wheel here and enter your card to withdraw.",
    "Emergency, your son met with an accident. Transfer hospital money right now to this account number.",
    "Dear user, we detected a virus on your device. Install our security app from this link to clean it.",
    "Your bank server is being upgraded. Kindly re-register your account by submitting your login credentials.",
    "Free Rs 500 Amazon voucher for the first 100 users. Click and complete the survey with your card details.",
    "Investment opportunity in forex, minimum risk, assured 25% return monthly. Send money to start earning.",
    "Your account is temporarily locked. To unlock, reply with your username, password and registered OTP.",
    "You have received 5000 reward points expiring today. Redeem now on this link by verifying your CVV.",
    "URGENT: suspicious transaction of 99,000 detected. Reply STOP and share OTP to cancel the transaction.",
    "Selected for scholarship of Rs 50,000. Submit your bank passbook and pay Rs 300 verification charge.",
    "Your Instagram account has a copyright strike. Verify your identity here or the account will be deleted.",
    "Dial this number to claim your gas subsidy immediately. Offer valid only for today, do not share with anyone.",
    "You won an international lottery in Spain. Send passport copy and processing fee to release 1 million USD.",
    "Bank alert: KYC pending. Download this APK and complete verification to keep your account active.",
    "Trading tips group with 100% accuracy. Pay 999 for VIP membership and double your capital this week.",
    "Your OTP is 884213. Do not share with anyone. Share it with our agent to complete the refund process.",
    "Final notice: pay the outstanding amount within 3 hours to avoid arrest warrant and court proceedings.",
    "Work from home data entry job. Registration fee only 350. Guaranteed payment weekly. Limited seats left.",
)

HAM_MESSAGES: tuple[str, ...] = (
    "Your OTP for login is 442819. Valid for 10 minutes. Do not share it with anyone.",
    "Your order #A2391 has been shipped and will be delivered by Friday. Track it in the app.",
    "Hi, are we still meeting for the project review at 4 pm tomorrow in the lab?",
    "Reminder: your electricity bill of Rs 1,240 is due on 28 August. Pay via the official app or website.",
    "Your account has been debited Rs 450.00 at SWIGGY on 21-08. Balance available in the app.",
    "Thank you for your payment. Your invoice receipt has been emailed to your registered address.",
    "Team, the sprint retrospective is moved to Thursday 11 am. Calendar invite updated.",
    "Your appointment with Dr. Mehta is confirmed for Monday at 10:30 am at City Clinic.",
    "Happy birthday! Wishing you a wonderful year ahead. Let's catch up this weekend.",
    "Your train PNR 4425678901 is confirmed, coach B3 seat 42. Departure 06:15 from platform 4.",
    "Your monthly statement is now available in net banking. Log in through the official app to view it.",
    "Class notice: the data structures lab exam is rescheduled to 5 September. Syllabus unchanged.",
    "Your package was delivered today at 3:12 pm. Thanks for shopping with us.",
    "Your subscription renews on 1 September for Rs 499. Manage your plan anytime in account settings.",
    "Please find attached the meeting minutes from today's stakeholder call for your review.",
    "Your refund of Rs 899 has been processed and will reflect in 5 to 7 working days.",
    "Movie booking confirmed: 2 tickets, screen 3, seats G12 and G13, show at 7:45 pm.",
    "Your library book is due on 3 September. Renew online or return it at the front desk.",
    "Congratulations on completing the certification course. Your certificate is available for download.",
    "Interview scheduled for the backend developer role on 30 August at 11 am. Join via the shared meeting link.",
    "Hey, I reached home safely. Thanks for dropping me. See you at college tomorrow.",
    "Your cab is arriving in 3 minutes. Driver Ramesh, white Swift, DL 3C AB 1234.",
    "Server maintenance is scheduled for Sunday 2 am to 4 am. Some services may be briefly unavailable.",
    "Your leave request for 2 September has been approved by your reporting manager.",
    "The internship stipend for August has been credited to your registered bank account.",
    "New comment on your pull request: please add a unit test for the risk scoring helper.",
    "Your flight AI 812 is on time. Boarding starts at 08:20 from gate 14.",
    "Fee receipt generated for semester 6. Download it from the student portal under the payments tab.",
    "Grocery order delivered. Rate your experience in the app to help us improve.",
    "Your parcel is out for delivery today. No action or payment is required from your side.",
    "Meeting notes: we agreed to ship the dashboard first and defer the export feature to next sprint.",
    "Your password was changed successfully. If this wasn't you, contact support through the official website.",
    "The workshop on machine learning starts at 9 am in seminar hall 2. Please carry your laptop.",
    "Your insurance premium receipt for policy 8892345 has been generated and mailed to you.",
    "Hi sir, I have submitted the assignment on the portal. Kindly confirm if it is received.",
    "Weekly report attached. Revenue is up 4 percent and churn is flat compared to last week.",
    "Your table for four is reserved at 8 pm. Please arrive 10 minutes early.",
    "Two factor authentication has been enabled on your account from a Windows device.",
    "The results for semester 5 are published. Log in to the university portal to view your grades.",
    "Thanks for your feedback. We have created ticket SUP-4412 and will respond within one business day.",
    "Your mobile recharge of Rs 239 was successful. Validity is 28 days with 1.5 GB per day.",
    "Practice session for the college fest is at 5 pm today near the auditorium.",
    "Your document has been signed by all parties. A copy is attached for your records.",
    "The build passed all 42 tests on the main branch. Deployment to staging is complete.",
    "Please review the attached budget sheet before the finance meeting on Wednesday.",
    "Your gym membership expires on 15 September. Visit the reception to renew whenever convenient.",
    "The power backup test is scheduled for tomorrow morning. Expect a brief outage of two minutes.",
    "Your feedback form response has been recorded. Thank you for taking the time.",
    "Hostel mess menu for this week is displayed on the notice board and the student app.",
    "Your car service is due at 40,000 km. Book a slot at your convenience on the service portal.",
    "Congratulations to the team for shipping release 2.4 ahead of schedule. Great work everyone.",
    "Your exam hall ticket is available in the portal. Carry a printed copy and a valid photo ID.",
    "I have pushed the fix for the login redirect issue. Please pull the latest changes.",
    "Your booking at Hotel Grand for 12 September is confirmed. Check-in from 2 pm.",
    "Attendance for August is 87 percent. No action needed as it is above the required minimum.",
    "Dinner at my place on Saturday around 8. Let me know if you can make it.",
    "The elective registration window closes on Friday 6 pm. Choose your subjects in the portal.",
    "Your salary slip for August is available in the employee self service portal.",
    "The guest lecture on cyber security is at 2 pm in block C. Attendance is optional.",
    "Your test results are normal. The detailed report is attached for your reference.",
)


def build_message_dataset() -> tuple[list[str], list[int]]:
    """Return ``(texts, labels)`` with 1 = scam, 0 = legitimate."""
    texts = list(SCAM_MESSAGES) + list(HAM_MESSAGES)
    labels = [1] * len(SCAM_MESSAGES) + [0] * len(HAM_MESSAGES)
    return texts, labels
