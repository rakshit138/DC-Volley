# Deploy DC Volley to Firebase Hosting

Follow these steps to host the app on Firebase so anyone can use it at a public URL.

---

## Prerequisites

- Firebase project is set up (Firestore, rules, web app config).
- `.env` exists in the project root with your Firebase config (same one you use locally).
- App runs locally with `npm run dev` and works as expected.

---

## Step 1: Install Firebase CLI

Install the Firebase CLI once (globally):

```bash
npm install -g firebase-tools
```

On Windows, if you get permission errors, use an elevated terminal or:

```bash
npm install -g firebase-tools --prefix %APPDATA%\npm
```

---

## Step 2: Log in to Firebase

```bash
firebase login
```

A browser window will open. Sign in with the Google account that owns your Firebase project (e.g. the one that has **dc-volley**).

---

## Step 3: Link your Firebase project

In the project root (`c:\Users\raksh\DC-Volley`):

```bash
firebase use dc-volley
```

Use your actual **Project ID** (from Firebase Console → Project settings). For example if your project is `dc-volley`, the command above is correct. This creates or updates `.firebaserc` so deploy uses that project.

If you haven’t linked before, you can instead run:

```bash
firebase init hosting
```

Then:

- Select your Firebase project (e.g. **dc-volley**).
- **What do you want to use as your public directory?** → `dist`
- **Configure as a single-page app?** → **Yes**
- **Set up automatic builds with GitHub?** → **No** (unless you want CI/CD)
- **Overwrite index.html?** → **No**

The project already has a `firebase.json` that points to `dist` and sets SPA rewrites, so `firebase init hosting` may add a second hosting block; if it does, you can edit `firebase.json` to keep a single `hosting` config with `public: "dist"` and the `rewrites` for `index.html`.

---

## Step 4: Build the app

Your `.env` is read at **build time**. Make sure `.env` is in the project root and has the correct Firebase config for the project you’re deploying to.

```bash
npm run build
```

This creates the `dist/` folder. That folder is what Firebase Hosting will serve.

---

## Step 5: Deploy to Firebase Hosting

```bash
firebase deploy --only hosting
```

When it finishes, the CLI will show something like:

```
Hosting URL: https://dc-volley.web.app
```

(or `https://dc-volley.firebaseapp.com`)

---

## Step 6: Share the URL

Share the **Hosting URL** with others. They can:

1. Open the link in a browser.
2. **Start New Game** to create a match and get a 6-character code.
3. **Join Game** by entering that code on another device.

No sign-in is required; the app and Firestore rules (as set in FIREBASE-SETUP.md) allow read/write for the `games` collection.

---

## Redeploying after changes

Whenever you change the code and want to update the live site:

```bash
npm run build
firebase deploy --only hosting
```

---

## Optional: Custom domain

1. In Firebase Console go to **Build → Hosting**.
2. Click **Add custom domain** and follow the steps (e.g. `volley.yourdomain.com`).
3. Point your domain’s DNS to the values Firebase shows. After verification, traffic will go to your app.

---

## Checklist

- [ ] Firebase CLI installed (`firebase --version`)
- [ ] Logged in (`firebase login`)
- [ ] Project linked (`firebase use your-project-id`)
- [ ] `.env` present and correct
- [ ] Build succeeds (`npm run build`)
- [ ] Deploy succeeds (`firebase deploy --only hosting`)
- [ ] App opens at the Hosting URL and creating/joining games works
