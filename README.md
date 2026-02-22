# DC Volley - Real-Time Volleyball Scoreboard

A scalable, production-ready React + Firebase real-time web application for managing volleyball matches. This application supports multi-screen game management with real-time score updates, lineup displays, and referee control panels.

## 🏗️ Project Overview

This application is designed for managing volleyball matches with the following features:

- **Creating a new game** - Generates unique 6-character join codes
- **Joining existing games** - Using game codes (like Google Meet)
- **Multiple display modes** - Scoreboard, Referee Panel, and Lineup Display
- **Real-time updates** - All screens update instantly via Firestore listeners
- **Fully responsive** - Works on mobile, tablet, and large screens
- **Production-ready** - Clean architecture with service layer separation

## ✨ Features

### 🏠 Home Screen (Entry Point)
- Text input for entering game codes
- "Join Game" button to connect to existing games
- "Start New Game" button to navigate to comprehensive game setup

### ⚙️ Game Setup Screen (New Game Creation)
A comprehensive 6-step setup wizard:
1. **Match Information** - Date, time, city, country, division, category, pool, competition, venue, format, substitution limit
2. **Match Officials** - 1st Referee, 2nd Referee, Scorer, Assistant Scorer
3. **Team Setup** - Team names and jersey colors
4. **Coin Toss** - Winner selection, choice (serve/receive/side), team assignment to sides A/B
5. **Team Rosters** - Up to 14 players per team with jersey numbers, names, and roles (Player, Captain, Libero 1, Libero 2)
6. **Starting Lineups** - Select players for positions P1-P6 for each team

All data is saved to Firestore when the game is created.

### 🎭 Display Selection Screen
After joining a game, users can select:
- **Scoreboard Display** - Public view, read-only, optimized for projectors
- **Referee Panel** - Full control with score management
- **Lineup Display** - Player positions and rotations

### 📊 Screens

#### 1. Scoreboard Display (Public Screen)
- Large, responsive typography for projector displays
- Real-time score updates
- Sets won indicators
- Game status (LIVE / FINISHED)
- Winner announcement overlay
- Read-only view

#### 2. Referee Panel (Score Control)
- **+1 Team A / +1 Team B** - Increment scores
- **Undo** - Revert last point
- **Next Set** - Mark set as complete and move to next
- **Mark Game as Finished** - End the match
- Real-time Firestore updates
- Validation (prevents negative scores)

#### 3. Lineup Display
- Court visualization with player positions
- Rotation order display
- Real-time updates
- Read-only view

## 🏛️ Architecture

### Folder Structure

```
src/
 ├── components/          # Reusable components (if needed)
 ├── pages/              # Page components
 │    ├── Home.jsx       # Entry point (game code entry)
 │    ├── GameSetup.jsx  # Comprehensive game setup wizard
 │    ├── DisplaySelect.jsx  # Role selection screen
 │    ├── Scoreboard.jsx     # Public scoreboard view
 │    ├── RefereePanel.jsx  # Referee control panel
 │    └── Lineup.jsx         # Lineup display
 ├── services/           # Business logic layer
 │    └── gameService.js # All Firestore operations
 ├── context/            # React Context
 │    └── GameContext.jsx    # Global game state
 ├── firebase/           # Firebase configuration
 │    └── config.js      # Firebase initialization
 ├── utils/              # Utility functions
 │    └── generateCode.js    # Game code generator
 ├── App.jsx             # Main app component with routing
 └── main.jsx            # Entry point
```

### Service Layer

All Firestore logic is centralized in `src/services/gameService.js`:

- `createGame()` - Creates new game document
- `getGameByCode()` - Retrieves game by code
- `listenToGame()` - Sets up real-time listener
- `updateScore()` - Updates team scores
- `updateSets()` - Marks set as won, moves to next
- `markGameFinished()` - Ends the game
- `updateLineup()` - Updates player lineups
- `undoLastPoint()` - Reverts last score change

### Firestore Schema

```javascript
games/{gameCode}
{
  gameCode: string,              // Unique 6-character code
  teamAName: string,             // Team A name
  teamBName: string,              // Team B name
  format: number,                // Best of 3 or 5
  status: 'LIVE' | 'FINISHED',   // Game status
  currentSet: number,            // Current set number (1-indexed)
  setsWon: {
    A: number,                   // Sets won by Team A
    B: number                    // Sets won by Team B
  },
  sets: [
    {
      setNumber: number,
      score: {
        A: number,
        B: number
      },
      serving: 'A' | 'B',        // Current serving team
      winner: 'A' | 'B' | null,  // Set winner (null if not finished)
      timeouts: {
        A: Array,                 // Timeout records
        B: Array
      },
      substitutions: {
        A: Array,                 // Substitution records
        B: Array
      },
      startTime: Timestamp,
      endTime: Timestamp | null
    }
  ],
  teams: {
    A: {
      players: Array,             // Player roster (jersey, name, role)
      lineup: Array               // Current lineup (jersey numbers)
    },
    B: {
      players: Array,
      lineup: Array
    }
  },
  officials: {
    ref1: string,                 // 1st Referee name
    ref2: string,                 // 2nd Referee name
    scorer: string,               // Scorer name
    assistScorer: string          // Assistant Scorer name
  },
  coinToss: {
    winner: string,               // 'team1' or 'team2'
    choice: string,               // 'serve', 'receive', or 'side'
    firstServer: string           // 'A' or 'B'
  },
  createdAt: Timestamp,
  updatedAt: Timestamp,
  finishedAt: Timestamp | null
}
```

## 🚀 Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- Firebase account (free tier works)

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Firebase Project Setup

#### 2.1 Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Add project" or select an existing project
3. Follow the setup wizard
4. Enable Google Analytics (optional)

#### 2.2 Enable Firestore Database

1. In Firebase Console, go to **Build > Firestore Database**
2. Click **"Create database"**
3. Choose **"Start in test mode"** (we'll update security rules later)
4. Select a location for your database (choose closest to your users)
5. Click **"Enable"**

#### 2.3 Get Firebase Configuration

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll down to **"Your apps"** section
3. Click the web icon (`</>`) to add a web app
4. Register your app (nickname: "DC Volley Web")
5. Copy the `firebaseConfig` object

#### 2.4 Create Environment Variables

1. Create a `.env` file in the project root:

```bash
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

2. Replace all values with your actual Firebase config values

#### 2.5 Update Firebase Config File

The config file at `src/firebase/config.js` already has the structure. The environment variables will be automatically loaded.

### Step 3: Security Rules (Development)

For development, you can use these permissive rules. **⚠️ Update for production!**

1. Go to **Firestore Database > Rules**
2. Replace with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write access to games collection
    match /games/{gameCode} {
      allow read, write: if true; // Development only!
    }
  }
}
```

3. Click **"Publish"**

**⚠️ Production Security Rules:**

For production, implement proper authentication and access control:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /games/{gameCode} {
      // Allow anyone to read (for public scoreboards)
      allow read: if true;
      
      // Only allow writes from authenticated users or implement custom logic
      allow write: if request.auth != null;
      // OR implement game code validation
      // allow write: if request.resource.data.gameCode == gameCode;
    }
  }
}
```

### Step 4: Run Locally

```bash
npm run dev
```

The app will be available at `http://localhost:5173` (or the port shown in terminal).

### Step 5: Build for Production

```bash
npm run build
```

The production build will be in the `dist/` folder.

## 📦 Deployment

### Option 1: Firebase Hosting (Recommended)

#### 5.1 Install Firebase CLI

```bash
npm install -g firebase-tools
```

#### 5.2 Login to Firebase

```bash
firebase login
```

#### 5.3 Initialize Firebase Hosting

```bash
firebase init hosting
```

When prompted:
- Select your Firebase project
- Public directory: `dist`
- Configure as single-page app: **Yes**
- Set up automatic builds: **No** (or Yes if using GitHub Actions)

#### 5.4 Deploy

```bash
npm run build
firebase deploy --only hosting
```

Your app will be live at: `https://your-project-id.web.app`

### Option 2: GitHub Pages / Netlify / Vercel

1. Build the project: `npm run build`
2. Deploy the `dist/` folder to your hosting provider
3. Configure environment variables in your hosting platform

### Option 3: GitHub Actions (CI/CD)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Firebase

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run build
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          channelId: live
          projectId: your-project-id
```

## 🔧 TODO Comments Location

The following files contain `// TODO:` comments that need your attention:

1. **`src/firebase/config.js`**
   - Add Firebase credentials
   - Enable Firestore
   - Enable Authentication (if needed)

2. **Firebase Console Tasks:**
   - Create Firebase project
   - Enable Firestore Database
   - Enable Authentication (optional - for anonymous auth)
   - Update security rules
   - Configure hosting
   - Set up environment variables

## 🎯 Usage Guide

### Creating a New Game

1. Open the app
2. Click **"Start New Game"**
3. A unique 6-character code is generated (e.g., `ABC123`)
4. Share this code with others to join
5. Select your display mode

### Joining a Game

1. Enter the 6-character game code
2. Click **"Join Game"**
3. Select your display mode

### Referee Panel Usage

- Click **"+1 Team A"** or **"+1 Team B"** to increment scores
- Click **"Undo"** to revert the last point
- Click **"Next Set"** when a set is complete (determines winner automatically)
- Click **"Mark Game as Finished"** to end the match

### Scoreboard Display

- Automatically updates in real-time
- Shows current scores, sets won, and game status
- Displays winner announcement when game finishes
- Optimized for large screens/projectors

### Lineup Display

- Shows player positions on court
- Displays rotation order
- Updates in real-time
- Read-only view

## 🛠️ Technology Stack

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **Firebase v9+** - Backend (Firestore for real-time database)
- **CSS3** - Styling (no UI libraries)

## 📝 Development Notes

### Real-Time Updates

All screens use Firestore `onSnapshot` listeners for real-time updates. No polling required.

### State Management

- React Context API for global game state
- Local state for UI-specific concerns
- Firestore as single source of truth

### Code Organization

- **Service Layer**: All Firestore operations in `gameService.js`
- **Components**: UI-only, no business logic
- **Context**: Global state management
- **Utils**: Pure utility functions

## 🐛 Troubleshooting

### "Firebase: Error (auth/configuration-not-found)"

- Check that `.env` file exists and has all required variables
- Verify variable names start with `VITE_`
- Restart dev server after creating `.env`

### "Permission denied" in Firestore

- Check Firestore security rules
- Ensure rules allow read/write operations
- For development, use test mode rules

### Game not updating in real-time

- Check browser console for errors
- Verify Firestore listener is active
- Check network connectivity
- Verify game code is correct

### Build errors

- Ensure all dependencies are installed: `npm install`
- Check Node.js version (18+ required)
- Clear cache: `rm -rf node_modules package-lock.json && npm install`

## 📄 License

This project is open source and available for use.

## 🤝 Contributing

Contributions are welcome! Please ensure:
- Code follows existing patterns
- Service layer logic stays in `gameService.js`
- Components remain UI-only
- Real-time listeners are used appropriately

## 📞 Support

For issues or questions:
1. Check this README
2. Review TODO comments in code
3. Check Firebase Console for configuration issues
4. Review browser console for errors

---

**DC Volley © 2025 | Digital Volleyball Scoresheet**

Built with React + Firebase for real-time volleyball match management.
