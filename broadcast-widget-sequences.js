// ════════════════════════════════════════════════════════════════
//  BROADCAST WIDGET — STATE MACHINE SEQUENCES
//  Depends on: all bwShow*/bwHide* layer helpers,
//              bwRenderScoreboard(), bwStartTimer(),
//              bwRenderStats(), bwCacheMatchThumb(),
//              bwCacheRosterThumb(), bwShowCachedImage(),
//              bwFlashTransition(), bwDelay(),
//              bwMatchData, bwTimerInterval, bwCurrentHalf,
//              bwHalf1Sequence, bwHalf2Sequence,
//              bwHalf1EndDone, bwHalf2EndDone, bwLastStatus
// ════════════════════════════════════════════════════════════════

// ── LAYER VISIBILITY ──
function bwShowCanvas() { bwCanvasLayer.classList.add('bw-visible'); }
function bwHideCanvas() { bwCanvasLayer.classList.remove('bw-visible'); }
function bwHideCanvasInstant() {
    bwCanvasLayer.style.transition = 'none';
    bwCanvasLayer.classList.remove('bw-visible');
    void bwCanvasLayer.offsetHeight; // force reflow
    bwCanvasLayer.style.transition = '';
}
function bwShowStats()  { bwStatsLayer.classList.add('bw-visible'); }
function bwHideStats()  { bwStatsLayer.classList.remove('bw-visible'); }

function bwShowScore() {
    bwScoreLayer.style.opacity = '1';
    bwScoreLayer.style.pointerEvents = 'none';
}
function bwHideScore() {
    bwScoreLayer.style.opacity = '0';
}

function bwScoreToTopLeft() {
    bwScoreLayer.classList.remove('bw-pos-bottom');
    bwScoreLayer.classList.add('bw-pos-topleft');
    bwShowScore();
}

function bwScoreToBottom() {
    bwScoreLayer.classList.remove('bw-pos-topleft');
    bwScoreLayer.classList.add('bw-pos-bottom');
}

// ── POST-GOAL: score widget briefly center-bottom then back ──
function bwPostGoalAnnouncement() {
    if (!bwMatchData || bwMatchData.status !== 'playing') return;
    bwScoreToBottom();
    bwShowScore();
    bwDelay(3000).then(function() {
        return bwFlashTransition(600);
    }).then(function() {
        bwScoreToTopLeft();
    });
}

// ── HALF START SEQUENCE ──
async function bwHalfStartSequence(half) {
    // Score widget appears at bottom-center for 5s, then slides to top-left
    bwHideCanvasInstant();
    bwHideStats();
    bwScoreToBottom();
    bwShowScore();
    await bwDelay(5000);
    await bwFlashTransition(600);
    bwScoreToTopLeft();
}

// ── HALF END SEQUENCE ──
async function bwHalfEndSequence(half) {
    // 1. Score to bottom-center for 3s
    bwScoreToBottom();
    bwShowScore();
    await bwDelay(3000);

    // 2. Hide score
    bwHideScore();
    await bwDelay(400);

    // 3. Show stats (if any home goals exist)
    const hasStats = await bwRenderStats(bwMatchData);
    if (hasStats) {
        await bwFlashTransition(700, function() {
            bwShowStats();
        });
        await bwDelay(10000);

        // Pre-render match thumb while stats are showing
        const thumbUrl = await bwCacheMatchThumb(bwMatchData, true);
        bwMatchThumbURL = thumbUrl;
        bwShowCachedImage(thumbUrl);

        // Fade out stats, reveal match thumb underneath
        await bwFlashTransition(700, function() {
            bwHideStats();
            bwShowCanvas();
        });
    } else {
        // No stats — fade directly to match thumbnail
        const thumbUrl = await bwCacheMatchThumb(bwMatchData, true);
        bwMatchThumbURL = thumbUrl;
        bwShowCachedImage(thumbUrl);
        await bwFlashTransition(700, function() {
            bwShowCanvas();
        });
    }
    // Canvas stays visible until next half starts
}

// ── INTRO SEQUENCE (on page load) ──
async function bwIntroSequence(matchData) {
    bwIntroShown = true;

    // Skip intro if match is already in progress
    const status = matchData.status;
    if (status === 'playing' || status === 'half1_ended' || status === 'half2_ended' || status === 'ended') {
        return;
    }

    // Pre-load roster thumbnail in background while match thumb is showing
    const teamId = matchData.team1Id;
    let rosterUrlPromise = null;
    if (teamId) {
        rosterUrlPromise = bwCacheRosterThumb(teamId).catch(function() { return null; });
    }

    // Show match thumbnail
    const showScore = (status !== 'waiting' && status !== 'scheduled');
    const mUrl = await bwCacheMatchThumb(matchData, showScore);
    bwMatchThumbURL = mUrl;
    bwShowCachedImage(mUrl);
    bwShowCanvas();
    await bwDelay(15000);

    // Cross-fade: overlay goes opaque → swap image underneath → overlay fades out
    const rUrl = rosterUrlPromise ? await rosterUrlPromise : null;
    if (rUrl) {
        bwRosterThumbURL = rUrl;
        await bwFlashTransition(700, function() {
            bwShowCachedImage(rUrl);
        });
        await bwDelay(15000);
    }

    // Cross-fade out to transparent
    await bwFlashTransition(700, function() {
        bwHideCanvas();
    });
}

// ── STATUS CHANGE HANDLER ──
async function bwOnStatusChange(newStatus, matchData) {
    bwMatchData = matchData;

    if (newStatus === bwLastStatus && newStatus !== 'playing') return;

    bwRenderScoreboard(matchData);

    if (newStatus === 'playing') {
        bwStartTimer(matchData);

        const half = matchData.currentHalf;
        const halfChanged = half !== bwCurrentHalf;
        bwCurrentHalf = half;

        if (half === 1 && !bwHalf1Sequence) {
            bwHalf1Sequence = true;
            await bwHalfStartSequence(1);
            bwScoreToTopLeft();
        } else if (half === 2 && !bwHalf2Sequence) {
            bwHalf2Sequence = true;
            bwHideCanvasInstant();
            await bwHalfStartSequence(2);
            bwScoreToTopLeft();
        } else if (!bwHalf1Sequence || !bwHalf2Sequence) {
            // sequence already running — just ensure score is visible
        } else {
            bwScoreToTopLeft();
        }
    }

    if (newStatus === 'half1_ended' && !bwHalf1EndDone) {
        bwHalf1EndDone = true;
        if (bwTimerInterval) { clearInterval(bwTimerInterval); bwTimerInterval = null; }
        await bwHalfEndSequence(1);
    }

    if ((newStatus === 'half2_ended' || newStatus === 'ended') && !bwHalf2EndDone) {
        bwHalf2EndDone = true;
        if (bwTimerInterval) { clearInterval(bwTimerInterval); bwTimerInterval = null; }
        await bwHalfEndSequence(2);
    }

    bwLastStatus = newStatus;
}

// ── GOALS LISTENER ──
function bwInitGoalsListener() {
    if (bwGoalsInitialized) return;
    bwGoalsInitialized = true;

    let initialLoad = true;
    database.ref('goals').orderByChild('matchId').equalTo(BW_MATCH_ID)
    .on('child_added', function(snap) {
        if (initialLoad) return;
        const goal = snap.val();
        if (!goal) return;
        bwHandleNewGoal(goal);
    });
    setTimeout(function() { initialLoad = false; }, 1500);
}
