# Dr. Ken Studio — iOS App (Xcode)

Native **SwiftUI** companion app for your Dr. Ken Studio web backend.  
Looks similar (cream + gold accents) but is **much easier to use on iPhone** with tabs and a step-by-step order wizard.

> **You need a Mac with Xcode** to open, run, and upload to the App Store.  
> This folder was created on Windows; Xcode only runs on macOS.

---

## What’s included

| Tab | Purpose |
|-----|---------|
| **Order** | Start guided new-order wizard + restore draft |
| **Orders** | Search, my orders, claim guest order |
| **Account** | Sign up / log in / profile / logout |
| **More** | API URL settings, tips, link to admin website |

### Apple-friendly extras (recommendations built in)

- **Tab bar navigation** — less scrolling than the website
- **4-step order wizard** — Your info → Packages → Recipients → Review
- **Local draft autosave** — survives signup / app restart
- **Share Sheet** for request IDs
- **Pull to refresh** on order lists
- **Haptics** on submit / errors / tab changes
- **Guest skip** + claim by request ID later
- **Profile autofill** when logged in
- **USD + CNY totals** (× 6.8)
- Admin stays on the **website** (better for CSV/reports on desktop)

---

## Open in Xcode (recommended — 5 minutes)

### Option A — Create a new Xcode project and drop files in

1. On a **Mac**, copy the `ios/DrKenStudio` folder over (USB, GitHub clone, iCloud, etc.)
2. Open **Xcode** → **File → New → Project**
3. Choose **iOS → App**
4. Settings:
   - Product Name: `DrKenStudio`
   - Team: your Apple ID team
   - Organization Identifier: e.g. `com.yourname`
   - Interface: **SwiftUI**
   - Language: **Swift**
   - Storage: none
5. Delete the default `ContentView.swift` / `DrKenStudioApp.swift` that Xcode created
6. In Finder, drag the entire `DrKenStudio/` source folder (App, Models, Services, Theme, Views, Info.plist) into the Xcode project navigator
7. Check **Copy items if needed** and **Create groups**
8. Select the target → **Signing & Capabilities** → choose your Team
9. At the top of `App/AppState.swift`, set:

```swift
static let defaultBaseURL = "https://YOUR-REAL-VERCEL-URL.vercel.app"
```

10. Pick an iPhone simulator → press **Run** (▶)

### Option B — XcodeGen (if you have Homebrew)

```bash
brew install xcodegen
cd ios/DrKenStudio
xcodegen generate
open DrKenStudio.xcodeproj
```

Then set the API URL as in step 9 above.

---

## Connect to your live API

1. Deploy the Next.js site to **Vercel** (already started)
2. Paste that URL into the app (**More → Server → API base URL**) or hardcode `defaultBaseURL`
3. Ensure CORS is fine — native apps don’t need browser CORS, but cookies do need your API to accept the iOS origin via cookie SameSite (already `lax` on the server)

### Cookie auth note

The app uses `URLSession` with shared cookie storage so login sessions match the website’s httpOnly cookies.

---

## TestFlight / App Store (high level)

1. Apple Developer Program enrollment ($99/year)
2. In Xcode: **Product → Archive**
3. Distribute to **App Store Connect** / TestFlight
4. Add screenshots, privacy nutrition labels (account + network), support URL
5. Submit for review

### Privacy / review tips

- Explain why you need network access (order submission)
- Don’t put real admin passwords in the app
- Provide a demo account for reviewers if signup is restricted

---

## Project layout

```
ios/DrKenStudio/
├── project.yml                 # optional XcodeGen spec
├── README.md                   # this file
└── DrKenStudio/
    ├── App/                    # @main + AppState
    ├── Models/                 # Order, Product, User, drafts
    ├── Services/               # API client + haptics
    ├── Theme/                  # Colors matching the website
    ├── Views/
    │   ├── Order/              # Home + wizard
    │   ├── Orders/             # Search / my orders / detail
    │   ├── Account/            # Auth + profile + settings
    │   └── Components/
    └── Info.plist
```

---

## Push notifications

The iOS app can receive alerts when an admin changes an order status.

### 1. Xcode capability

1. Select the **DrKenStudio** target  
2. **Signing & Capabilities** → **+ Capability** → **Push Notifications**  
3. Also add **Background Modes** → check **Remote notifications** (Info.plist already lists it)

### 2. Apple Developer key

1. [developer.apple.com](https://developer.apple.com) → **Certificates, Identifiers & Keys** → **Keys**  
2. Create a key with **Apple Push Notifications service (APNs)**  
3. Download the `.p8` file (only once)  
4. Note **Key ID** and your **Team ID**

### 3. Server / Vercel env vars

Add to `.env` and Vercel:

```env
APNS_KEY_ID="XXXXXXXXXX"
APNS_TEAM_ID="XXXXXXXXXX"
APNS_BUNDLE_ID="com.drkenstudio.orders"
APNS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----"
APNS_PRODUCTION="false"
```

Use `APNS_PRODUCTION="true"` for TestFlight / App Store builds (required).  
On Vercel production, production APNs is used automatically if this var is unset.  
Use `"false"` only for local Xcode debug builds (sandbox APNs).

> **Note:** Simulators often cannot receive real APNs. Test on a physical iPhone.

### 4. Database

```bash
npx prisma db push
```

Creates `device_push_tokens`.

### 5. How it works in the app

- After submitting an order → **Notify me of updates**
- **More → Notifications → Enable order alerts**
- After login, the device token is linked to the account
- Guests can watch a specific request ID
- Status changes in the admin dashboard trigger pushes

---

## Project layout

```
ios/DrKenStudio/
├── project.yml                 # optional XcodeGen spec
├── README.md                   # this file
└── DrKenStudio/
    ├── App/                    # @main + AppState
    ├── Models/                 # Order, Product, User, drafts
    ├── Services/               # API, push, haptics
    ├── Theme/                  # Colors matching the website
    ├── Views/
    │   ├── Order/              # Home + wizard
    │   ├── Orders/             # Search / my orders / detail
    │   ├── Account/            # Auth + profile + settings
    │   └── Components/
    └── Info.plist
```
