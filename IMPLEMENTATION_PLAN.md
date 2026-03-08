# Complete Function Implementation Plan

## Status: CRITICAL FUNCTIONS FIRST

### Phase 1: Core Game Functions (HIGH PRIORITY)

#### 1. Undo System (CRITICAL - Currently Incomplete)
**Original HTML**: Full action history with complete state restoration
**Current React**: Simple score decrement only
**Required Implementation**:
- Add `actionHistory` array to game data structure
- Save state before each action:
  - `previousScore: {A, B}`
  - `previousServing`
  - `previousLineupA/B`
  - `previousLiberoReplacementsA/B`
  - `previousSummaryLength`
  - `sanctionSnapshot` (for sanction points)
- Implement full undo that restores:
  - Scores
  - Serving team
  - Lineups
  - Libero replacements
  - Match summary
  - Sanction system (if point came from sanction)
  - Set winner (if undoing set completion)
- Handle special case: If at start of new set (0-0), revert to previous set

**Files to Update**:
- `src/services/gameService.js` - Add `saveActionToHistory`, update `undoLastPoint`
- Update all action functions to save history before executing

#### 2. Action History Saving
**Functions that need to save history**:
- `addPoint` ✅ (already saves in original HTML)
- `recordTimeout` ❌ (needs history)
- `recordSubstitution` ❌ (needs history)
- `recordExceptionalSubstitution` ❌ (needs history)
- `recordLiberoReplacementWithTracking` ❌ (needs history)
- `removeLiberoFromCourt` ❌ (needs history)
- `rotateLineup` ❌ (needs history)
- `recordSanction` ✅ (already saves in original HTML)

### Phase 2: Verify All Function Behaviors

#### Game Actions
- [ ] `addPointToTeam` - Verify rotation, libero checks, set completion
- [ ] `toggleRally` - Verify libero serve validation
- [ ] `manualRotate` - Verify auto libero exit check
- [ ] `swapSides` - Simple toggle, verify

#### Substitution Functions
- [ ] `confirmSubstitution` - Verify all pairing/completion rules
- [ ] `confirmExceptionalSubstitution` - Verify injury tracking
- [ ] `countCompletedSubstitutions` - Verify counting logic

#### Libero Functions
- [ ] `checkAutoLiberoEntry` - Verify triggers
- [ ] `checkAutoLiberoEntryAfterLosingService` - Verify timing
- [ ] `autoReplaceLiberoInFrontRow` - Verify front row detection
- [ ] `confirmLiberoReplacement` - Verify all rules
- [ ] `removeLiberoFromCourt` - Verify restoration

#### Set Management
- [ ] `startNextSet` - Verify lineup reset, substitution reset
- [ ] `showDecidingSetToss` - Verify coin toss flow
- [ ] `showNewSetLineupSetup` - Verify modal opening

#### Sanction System
- [ ] All `sm*` functions - Verify escalation, consequences, required actions

### Phase 3: Missing Functions

#### Display Functions
- [ ] `openLineupDisplay` - Open lineup view
- [ ] `openScoreboard` - Open scoreboard view

#### Export Functions
- [ ] `exportToPDF` - Export match to PDF
- [ ] `exportHistoryPDF` - Export history to PDF
- [ ] `exportSummaryPDF` - Export summary to PDF
- [ ] `downloadMatchDataPDF` - Download match data

#### Roster Management
- [ ] `saveRosterOnly` - Save roster separately
- [ ] `loadRosterOnly` - Load roster separately
- [ ] `saveTeam1Roster` / `saveTeam2Roster` - Individual team rosters
- [ ] `loadTeam1Roster` / `loadTeam2Roster` - Individual team rosters

### Phase 4: UI/Display Functions

#### Match Display
- [ ] `updateMatchDisplay` - Update all UI elements
- [ ] `updateCourtDisplay` - Update court visualization
- [ ] `updateLineupPanel` - Update lineup list
- [ ] `updatePointButtons` - Enable/disable buttons

#### Timer Functions
- [ ] `startMatchTimer` - Start match duration timer
- [ ] `updateTimerDisplay` - Update timer display
- [ ] `startIntervalTimer` - Start set break timer
- [ ] `formatIntervalTime` - Format time display

## Implementation Order

1. **CRITICAL**: Implement full undo system with action history
2. **HIGH**: Verify all game action functions match exactly
3. **MEDIUM**: Implement missing utility functions
4. **LOW**: UI/display functions (many are React-specific)

## Notes

- Many HTML functions are UI-specific and need React equivalents
- Some functions are combined in React (e.g., modal handling)
- Focus on game logic functions first, UI functions can be adapted
