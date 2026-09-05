# 🛡️ FraudShield AI — Browser Extension (Chrome & Edge)

Real-Time Neural Scam & Phishing Protection Extension powered by **Manifest V3**.

---

## 🌟 Features

1. **Active Tab Quick Inspector**:
   - Automatically detects current web address.
   - One-click page safety analysis.
2. **Right-Click Context Menu Protection**:
   - **Right-click any link** $\to$ *🛡️ Scan link with FraudShield AI*.
   - **Select any suspicious text/message** $\to$ *🛡️ Analyze selected text for scam / fraud*.
   - **Right-click anywhere on a webpage** $\to$ *🛡️ Check this page for phishing threats*.
3. **In-Page Floating Verdict Card**:
   - Threat verdicts pop up right on your active tab with risk bands (`CRITICAL`, `HIGH`, `MEDIUM`, `SAFE`), explainable factors, and score `/100`.
   - Direct button to open the full detailed report in the FraudShield web dashboard.
4. **Popup Quick Scanner**:
   - Dedicated dark cyberpunk interface matching the FraudShield platform.
   - Live backend health indicator (`ONLINE` / `OFFLINE`).
   - Preset buttons for testing common phishing links and scam SMS/OTP fraud messages.
   - Automatic background JWT authentication with seeded demo accounts.

---

## 🚀 How to Install in Chrome or Edge (100% Free)

You do **not** need a developer license or store approval to run and test this extension on your machine.

### Step 1: Open Extensions Page
- **Google Chrome / Brave**: Type `chrome://extensions` in your address bar and press **Enter**.
- **Microsoft Edge**: Type `edge://extensions` in your address bar and press **Enter**.

### Step 2: Enable "Developer Mode"
- In the top-right corner of the Extensions page, toggle the **Developer mode** switch to **ON**.

### Step 3: Load the Extension
1. Click the **"Load unpacked"** button in the top-left corner.
2. In the folder picker dialog, navigate to and select this directory:
   ```
   FraudAI/extension
   ```
3. Click **Select Folder**.
4. **FraudShield AI** will now appear in your browser toolbar!
5. *(Optional)* Click the puzzle piece icon (🧩) in your browser bar and **Pin** FraudShield AI for quick access.

---

## 🔄 How to See Changes Later (After Code Edits)

Whenever you make any changes to files inside `FraudAI/extension/`:

### 1. If you edited `popup.html`, `popup.css`, or `popup.js`:
- Changes are **instant**! Simply close the extension popup and click the shield icon again. The new styles and logic load immediately.

### 2. If you edited `background.js` or `manifest.json`:
- Go to `chrome://extensions` (or `edge://extensions`).
- Find the **FraudShield AI** card.
- Click the **Reload (🔄)** circular arrow icon on the card.
- The service worker restarts with your latest code.

### 3. If you edited `content.js` or `content.css`:
- Click the **Reload (🔄)** button on the extension card in `chrome://extensions`.
- Then **refresh (F5)** the webpage where you want to test the in-page floating cards.

---

## 🧪 Testing the Extension

Ensure your FraudShield backend is running (`docker compose up` or `python -m uvicorn app.main:app --port 8000`).

### Test 1: Right-Click Scanning
1. Highlight any text on a webpage (e.g. *"URGENT: Your bank account is locked, click here to verify"*).
2. Right-click and choose **"🛡️ Analyze selected text for scam / fraud"**.
3. A floating cyber card will appear in the top-right corner with the AI scam verdict.

### Test 2: Quick Popup Scan
1. Click the FraudShield AI shield icon in your browser toolbar.
2. Verify the status indicator says **"Backend Online"** with a green pulse.
3. Click the **"Phishing Link"** demo preset button and hit **"Analyze URL Safety"**.
4. View the instant risk score (e.g. 88/100) and click **"Open In Full Dashboard ↗"** to see the full analytics report.
