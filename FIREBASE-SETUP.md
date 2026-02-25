# Step-by-Step Firebase Setup for DC Volley

Follow these steps to set up this project with Firebase (Firestore + optional Hosting).

---

## Prerequisites

- **Node.js 18+** and npm installed
- A **Google account** (for Firebase Console)

---

## What you need (required vs optional)

| Step | Required? | Purpose |
|------|-----------|--------|
| 1–4, 5, 7 | **Yes** | Project, Firestore, web app config, security rules, run app |
| 6 – Authentication | No | Only if you add sign-in later |
| 8 – Hosting | No | Only to deploy the app online |
| Analytics (`measurementId`) | No | Only if you want usage analytics |

You do **not** need Realtime Database, Cloud Storage, or Cloud Functions for this project. Firestore + rules + `.env` is enough.

---

## Step 1: Create a Firebase project

1. Open **[Firebase Console](https://console.firebase.google.com)**.
2. Click **"Add project"** (or choose an existing project).
3. Enter a project name (e.g. `dc-volley`) and continue.
4. Turn **Google Analytics** on or off (optional), then create the project.

---

## Step 2: Enable Firestore Database

1. In the left sidebar, go to **Build → Firestore Database**.
2. Click **"Create database"**.
3. If asked for **Database ID**, leave it as **(default)**. Do not enter a custom ID unless you need multiple databases.
4. Choose **"Start in test mode"** (you’ll tighten rules later).
5. Pick a **location** (e.g. `us-central1` or closest to your users).
6. Click **"Enable"**.

---

## Step 3: Register a web app and get config

1. In Firebase Console, click the **gear icon** next to "Project Overview" → **Project settings**.
2. Scroll to **"Your apps"**.
3. Click the **web icon** `</>` to add a web app.
4. Register the app (e.g. nickname: **DC Volley Web**). Don’t enable Firebase Hosting here.
5. Copy the **`firebaseConfig`** object (you’ll use it in the next step).

---

## Step 4: Add config to the project (environment variables)

1. In the **project root** of DC-Volley (same folder as `package.json`), create a file named **`.env`**.
2. Add these lines and replace the placeholder values with the ones from your `firebaseConfig`:

```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
# Optional: for Firebase Analytics
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

**Mapping from Firebase Console:**

| Firebase config key   | Your .env variable                    | Required |
|-----------------------|----------------------------------------|----------|
| `apiKey`              | `VITE_FIREBASE_API_KEY`               | Yes      |
| `authDomain`          | `VITE_FIREBASE_AUTH_DOMAIN`           | Yes      |
| `projectId`           | `VITE_FIREBASE_PROJECT_ID`            | Yes      |
| `storageBucket`       | `VITE_FIREBASE_STORAGE_BUCKET`        | Yes      |
| `messagingSenderId`   | `VITE_FIREBASE_MESSAGING_SENDER_ID`   | Yes      |
| `appId`               | `VITE_FIREBASE_APP_ID`                | Yes      |
| `measurementId`       | `VITE_FIREBASE_MEASUREMENT_ID`        | No (Analytics) |

3. Save `.env`. **Do not commit it to git** (it should be in `.gitignore`).

---

## Step 5: Set Firestore security rules (development)

1. In Firebase Console, go to **Build → Firestore Database**.
2. Open the **Rules** tab.
3. Replace the rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /games/{gameCode} {
      allow read, write: if true;
    }
  }
}
```

4. Click **"Publish"**.

**Note:** These rules allow anyone to read/write. For production, use the stricter rules described in the main README.

---

## Where is game data saved?

All game data is stored in **Firestore**, in a single collection:

- **Collection:** `games`
- **Document ID:** the **6-character game code** (e.g. `ABC123`)
- **Path:** `games/ABC123`

So one game = one document. The document holds teams, scores, sets, rosters, lineups, match info, officials, timestamps, etc. The full schema is in the main **README.md** (Firestore Schema section).

You can inspect or debug data in Firebase Console: **Build → Firestore Database → Data** → open the `games` collection and any document (e.g. `ABC123`).

---

## How does the game join code work?

1. **Code format:** 6 characters — 3 letters + 3 numbers (e.g. `XY7K92`). Generated in the app by `src/utils/generateCode.js`.

2. **Uniqueness:** When you click **Start New Game** and finish setup, the app:
   - Generates a code.
   - Checks Firestore for a document with that ID in `games` (`getGameByCode(code)`).
   - If it already exists, generates a new code and checks again (up to 10 tries).
   - Creates the game with `createGame(code, gameData)`, which writes to `games/{code}`.

3. **Joining:** To join, the user enters the code and clicks **Join Game**. The app calls `getGameByCode(code)`, which reads the document `games/{code}`. If it exists, they’re in; if not, “Game not found”.

4. **No separate “codes” table:** The join code **is** the Firestore document ID. There is no extra index or table; lookup is a direct document read by ID, which is fast and simple.

---

## Step 6: (Optional) Enable Authentication

The app initializes Auth; you only need to enable it if you plan to use sign-in later.

1. In Firebase Console: **Build → Authentication**.
2. Click **"Get started"**.
3. If you want anonymous sign-in: **Sign-in method** → **Anonymous** → Enable → Save.

---

## Step 7: Install dependencies and run locally

In the project root:

```bash
npm install
npm run dev
```

The app should open at **http://localhost:5173** (or the port shown in the terminal). Create a new game and join with the code to confirm Firestore works.

---

## Step 8: (Optional) Deploy to Firebase Hosting

1. Install Firebase CLI (once):

   ```bash
   npm install -g firebase-tools
   ```

2. Log in:

   ```bash
   firebase login
   ```

3. Initialize Hosting in the project root:

   ```bash
   firebase init hosting
   ```

   - Choose your Firebase project.
   - **Public directory:** `dist`
   - **Single-page app:** Yes
   - **Overwrite index.html:** No

4. Build and deploy:

   ```bash
   npm run build
   firebase deploy --only hosting
   ```

Your app will be available at `https://YOUR_PROJECT_ID.web.app`.

---

## Quick checklist

- [ ] Firebase project created
- [ ] Firestore created (test mode) and location set
- [ ] Web app added and `firebaseConfig` copied
- [ ] `.env` created with all `VITE_FIREBASE_*` variables
- [ ] Firestore rules published (games collection)
- [ ] `npm install` and `npm run dev` run successfully
- [ ] (Optional) Authentication enabled
- [ ] (Optional) Hosting initialized and deployed

---

## Troubleshooting

| Issue | What to do |
|-------|------------|
| **"Firebase: Error (auth/configuration-not-found)"** | Ensure `.env` exists, all `VITE_` variables are set, and restart the dev server (`npm run dev`). |
| **Permission denied in Firestore** | Check Firestore Rules; for development use the permissive rules above. |
| **Scores/game not updating** | Confirm correct game code, check browser console and network tab. |
| **Build fails** | Run `npm install`, use Node 18+, and ensure `.env` is present for build. |

For more detail, see the main **README.md** and the Firestore schema section there.
