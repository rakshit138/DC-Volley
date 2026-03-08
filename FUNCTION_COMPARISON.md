# Complete Function Comparison: HTML vs React

## Function Categories

### 1. Setup & Initialization (15 functions)
- initRosterTables
- createRosterRows
- addRowListeners
- checkDuplicateJersey
- checkDuplicateJerseyInstant
- validateRoleSelection
- updatePlayerData
- updateCount
- determineCoinTossOutcome
- determineFirstServer
- validateAndProceed
- applyTeamColors
- showLineupSetup
- renderRosterSetup
- selectPlayerForLineup

### 2. Game Actions (20 functions)
- addPointToTeam
- addPoint
- saveActionToHistory
- manualRotate
- rotateTeam
- autoReplaceLiberoInFrontRow
- toggleRally
- swapSides
- undoPoint
- takeTimeout
- endTimeout
- startMatch
- startMatchTimer
- updateTimerDisplay
- startIntervalTimer
- formatIntervalTime
- updateMatchDisplay
- updateCourtDisplay
- updateLineupPanel
- updatePointButtons

### 3. Substitution (12 functions)
- openSubModal
- renderSubPlayers
- selectPlayerOut
- selectPlayerIn
- updateSubInfo
- confirmSubstitution
- countCompletedSubstitutions
- closeSubModal
- openExceptionalSubModal
- renderExceptionalSubPlayers
- selectExceptionalPlayerOut
- selectExceptionalPlayerIn
- updateExceptionalConfirmButton
- confirmExceptionalSubstitution
- closeExceptionalSubModal

### 4. Libero Management (15 functions)
- checkAutoLiberoEntry
- checkAutoLiberoEntryAfterLosingService
- checkAutoLiberoEntryWithCallback
- showAutoLiberoEntryModal
- confirmAutoLiberoEntry
- skipAutoLiberoEntry
- showAutoLiberoExitModal
- confirmAutoLiberoExit
- openLiberoModal
- renderLiberoOptions
- selectLibero
- selectBackRowPlayer
- updateLiberoInfo
- confirmLiberoReplacement
- removeLiberoFromCourt
- closeLiberoModal
- isPlayerReplacedByLibero
- getPlayerReplacedByLibero

### 5. Set Management (8 functions)
- showDecidingSetToss
- decidingSetTossWinner
- decidingSetTossChoice
- closeDecidingSetTossModal
- startNextSet
- manuallyOpenNextSetLineup
- showNewSetLineupSetup
- cancelLineup

### 6. Sanction System (25 functions - all sm*)
- smSelectModule
- smSelectTeam
- smSelectPerson
- smSelectMisconductType
- smSelectDelayType
- smShowConsequence
- smShowDelayConsequence
- smRefreshEscalation
- smRefreshDelayPanel
- smConfirmMisconduct
- smConfirmDelay
- smShowRedConfirm
- smRedConfirmYes
- smRedConfirmNo
- smCheckSubRequired
- smSubReqSelect
- smSubReqConfirm
- smSubReqDismiss
- smHandleCaptainDisqualified
- smConfirmNewCaptain
- smCloseCaptainReq
- smHandleIncompleteTeam
- smHandleLiberoSanction
- smIsCaptainPlayer
- smIsLiberoPlayer
- smIsPlayerBlockedFromSub
- smUpdateLiveSanctionLog
- smStyleReset
- smApplyMisconduct
- recordSanction

### 7. Roster Management (10 functions)
- openRosterModal
- closeRosterModal
- saveRosterOnly
- loadRosterOnly
- updateRosterTable
- saveTeam1Roster
- saveTeam2Roster
- loadTeam1Roster
- loadTeam2Roster
- updatePlayerCount

### 8. Match Data & History (12 functions)
- openHistoryModal
- populateHistoryModal
- closeHistoryModal
- exportHistoryPDF
- saveMatch
- loadMatch
- endMatch
- openMatchDataModal
- populateMatchDataModal
- closeMatchDataModal
- openSummaryModal
- populateSummaryTable
- closeSummaryModal
- exportSummaryPDF
- exportToPDF
- downloadMatchDataPDF
- addSummaryEvent

### 9. Display Views (3 functions)
- openLineupDisplay
- openScoreboard
- assignPosition
- updateCourtSetup

### 10. Officials (5 functions)
- openOfficialsModal
- populateOfficialsModal
- saveOfficials
- closeOfficialsModal
- initializeSignaturePads
- clearSignature

### 11. Utilities (5 functions)
- getSubLimit
- formatIntervalTime

## Status: IN PROGRESS
This document will be updated as functions are verified and implemented.
