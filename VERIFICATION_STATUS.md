# Function Verification Status

## Action History Functions (CRITICAL)

### ✅ COMPLETED
1. **addPoint** - Saves complete state (scores, serving, lineups, libero replacements, match summary length)
2. **undoLastPoint** - Full restoration of all state types

### ❌ NEEDS ACTION HISTORY
3. **recordTimeout** - Needs to save: team, set number
4. **recordSubstitution** - Needs to save: team, playerOut, playerIn, position, previousLineup, previousSubstitutionTracking, previousCompletedSubstitutions
5. **recordExceptionalSubstitution** - Needs to save: team, playerOut, playerIn, position, previousLineup
6. **recordLiberoReplacementWithTracking** - Needs to save: team, libero, originalPlayer, position, previousLineup, previousLiberoReplacements
7. **removeLiberoFromCourt** - Needs to save: team, libero, previousLineup, previousLiberoReplacements
8. **rotateLineup** - Needs to save: team, previousLineup, previousLiberoReplacements

### ✅ ALREADY SAVES (via awardPenaltyPoint)
9. **recordSanction** - When awarding penalty point, saves via awardPenaltyPoint which calls saveActionToHistory

## Next Steps

1. Add action history saving to all functions listed above
2. Update undoLastPoint to handle all action types
3. Verify all 147 functions match original HTML behavior
