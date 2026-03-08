# Complete Verification Checklist - React vs Original HTML

This document lists all areas that must match exactly between the React implementation and the original HTML file.

## ✅ SUBSTITUTION RULES (VERIFIED)

### Substitution Limit Check
- **Original HTML**: Uses `countCompletedSubstitutions()` which counts ALL substitution actions (not just completed ones)
- **React**: Counts all substitutions in `set.substitutions[team].length` ✅ MATCHES

### Pairing Rules
- **Rule 1**: Player who completed substitution cannot sub again ✅
- **Rule 2**: If playerOut is paired, can ONLY sub with paired player ✅
- **Rule 3**: If playerIn is paired, can ONLY sub with paired player ✅

### Completion Logic
- When a player returns (OUT then back IN), both players are marked as completed ✅
- Completed players added to `completedSubstitutions` array ✅

## 🔍 AREAS TO VERIFY

### 1. LIBERO RULES

#### When Libero Rotates to P1
- **Original HTML**: Validates when starting rally via `validateServeStart()`
- **React**: Currently opens libero modal if no designated player set
- **ACTION NEEDED**: Verify if original HTML opens modal automatically or just validates

#### Libero Replacement Rules
- Libero can only replace back-row players (P1, P5, P6) ✅
- Libero cannot serve unless designated player is in P1 ✅
- Libero must exit when rotating to front row ✅

### 2. ROTATION LOGIC

#### Automatic Rotation After Point
- Rotation happens when service changes ✅
- Clockwise rotation (P1→P6, P2→P1, etc.) ✅
- Auto libero exit check after rotation ✅
- Auto libero entry check for opponent after losing service ✅

#### Manual Rotation
- Confirmation dialog ✅
- Calls `autoReplaceLiberoInFrontRow()` ✅

### 3. BUTTON FUNCTIONALITIES

#### Point Scoring (+1 Team A/B)
- Must have rally active ✅
- Auto-stops rally after point ✅
- Rotates team when service changes ✅
- Checks for set completion ✅

#### Timeout
- Limit of 2 per set ✅
- Shows timeout modal with timer ✅

#### Substitution
- Opens substitution modal ✅
- Validates pairing rules ✅
- Validates completion rules ✅
- Validates substitution limit ✅

#### Libero Replacement
- Opens libero modal ✅
- Validates back-row only ✅
- Validates serving rules for P1 ✅

#### Sanction
- Misconduct types: W, P, EXP, DISQ ✅
- Delay types: DW, DP ✅
- Auto-adds point for P/EXP/DISQ/DP ✅
- Tracks disqualified players ✅

#### Undo
- **ISSUE FOUND**: Current implementation is too simple
- **Original HTML**: Uses `actionHistory` to undo last action completely
- **ACTION NEEDED**: Implement full undo with history tracking

### 4. MODALS AND POPUPS

#### Auto Libero Entry Modal
- Triggers at match start (0-0) ✅
- Triggers after losing service ✅
- Shows player to be replaced ✅
- Shows available liberos ✅

#### Auto Libero Exit Modal
- Triggers when libero rotates to front row ✅
- Shows libero and original player ✅
- Confirms removal ✅

#### Libero P1 Violation
- **CURRENT**: Opens libero modal if no designated player
- **NEEDS VERIFICATION**: Check original HTML behavior

### 5. SET COMPLETION

#### Set Win Conditions
- 25 points (15 for deciding set) ✅
- Must win by 2 points ✅
- Auto-completes set ✅
- Updates sets won ✅
- Checks for match completion ✅

### 6. NEXT SET SETUP

#### Regular Set
- Opens lineup setup modal ✅
- Resets substitutions, timeouts ✅
- New starting lineup ✅

#### Deciding Set
- Conducts coin toss first ✅
- Then opens lineup setup ✅

## 🚨 CRITICAL ISSUES FOUND

### 1. UNDO FUNCTIONALITY
**Status**: INCOMPLETE
- Current: Simple score decrement
- Required: Full action history with complete undo
- **PRIORITY**: HIGH

### 2. LIBERO P1 ROTATION
**Status**: NEEDS VERIFICATION
- Current: Opens modal if no designated player
- **ACTION**: Verify original HTML behavior when libero rotates to P1

## 📋 VERIFICATION STEPS

1. Test substitution pairing rules with multiple substitutions
2. Test libero rotation to P1 with and without designated player
3. Test undo functionality with various actions
4. Test all button clicks and modal triggers
5. Test rotation logic after every point
6. Test set completion and next set setup
7. Test sanction system with all types
8. Test exceptional substitutions

## 📝 NOTES

- Substitution limit: Counts ALL actions, not just completed pairs
- Libero serve: Requires designated player configuration
- Rotation: Only happens when service changes
- Auto modals: Triggered by lineup changes, not manual actions
