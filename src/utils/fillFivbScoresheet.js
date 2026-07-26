export async function fillFIVBScoresheet(templateBytes, gameData, PDFLib) {
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const pdf = await PDFDocument.load(templateBytes);
  if (pdf.getPageCount() > 1) pdf.removePage(1); // page 2 = printed instructions, not needed
  const page = pdf.getPages()[0];
  if (pdf.getPageCount() > 1) pdf.removePage(1); // instructions page not needed
  const PH = 297; // mm
  const K = 72 / 25.4; // mm -> pt

  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const helvB = await pdf.embedFont(StandardFonts.HelveticaBold);

  // ── data ──────────────────────────────────────────────────────────
  const sets = gameData.sets || [];
  const mi = gameData.matchInfo || {};
  const off = gameData.officials || {};
  const plA = (gameData.teams && gameData.teams.A && gameData.teams.A.players) || [];
  const plB = (gameData.teams && gameData.teams.B && gameData.teams.B.players) || [];
  const tA = mi.teamAName || 'Team A', tB = mi.teamBName || 'Team B';
  function ab3(n){ if(!n) return '???'; const w=n.trim().split(/\s+/).filter(Boolean); return w.length===1 ? w[0].slice(0,3).toUpperCase() : w.map(x=>x[0]).join('').slice(0,3).toUpperCase(); }
  const abA = ab3(tA), abB = ab3(tB);
  function FT(ts){ if(!ts) return ''; const d=new Date(ts); return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2); }
  function FTh(ts){ if(!ts) return ''; const d=new Date(ts); return ('0'+d.getHours()).slice(-2); }
  function FTm(ts){ if(!ts) return ''; const d=new Date(ts); return ('0'+d.getMinutes()).slice(-2); }
  function DM(a,b){ return (!a||!b) ? 0 : Math.max(0, Math.round((b-a)/60000)); }

  // ── drawing helpers (mm, y from TOP) ─────────────────────────────
  function T(s, xmm, ybase_mm, size, bold, align) {
    if (s == null) s = ''; s = String(s); if (!s) return;
    const f = bold ? helvB : helv;
    let x = xmm * K;
    if (align === 'C') x -= f.widthOfTextAtSize(s, size) / 2;
    else if (align === 'R') x -= f.widthOfTextAtSize(s, size);
    page.drawText(s, { x, y: (PH - ybase_mm) * K, size, font: f, color: rgb(0.05,0.05,0.35) });
  }
  function LN(x1,y1,x2,y2,w,col) {
    page.drawLine({ start:{x:x1*K, y:(PH-y1)*K}, end:{x:x2*K, y:(PH-y2)*K},
      thickness:(w||0.4)*K*0.35, color: col || rgb(0.05,0.05,0.35) });
  }
  function CIRC(cx,cy,r,w,col) {
    page.drawEllipse({ x:cx*K, y:(PH-cy)*K, xScale:r*K, yScale:r*K,
      borderWidth:(w||0.45)*K*0.35, borderColor: col || rgb(0.7,0,0) });
  }
  function XM(cx,cy,s) { // X mark centered at cx,cy
    s = s || 1.4;
    LN(cx-s, cy-s, cx+s, cy+s, 0.5);
    LN(cx-s, cy+s, cx+s, cy-s, 0.5);
  }
  function TICK(cx,cy) { // small check mark
    LN(cx-1.2, cy+0.1, cx-0.4, cy+0.9, 0.45);
    LN(cx-0.4, cy+0.9, cx+1.2, cy-1.0, 0.45);
  }
  // ── FIVB service round simulation from pointLog ──────────────────
  // pointLog: [{t:'A'|'B' scorer, a,b: score after, srv: serving team BEFORE point}]
  // returns per-team list of box marks {col:0-5, box:1-8, tick, x, score, circled}
  function simulateServiceRounds(sd, boxesPerCol) {
    const marks = { A: [], B: [] };
    const log = sd.pointLog || [];
    if (!log.length) return marks;
    const first = sd.firstServer || sd.serving || log[0].srv || 'A';
    const usage = { A:[0,0,0,0,0,0], B:[0,0,0,0,0,0] };
    const cur = {};       // cur[team] = {col, box, mark}
    const served = { A:false, B:false };
    let servingTeam = first;
    // first service: tick box 1 col I
    usage[first][0] = 1;
    served[first] = true;
    cur[first] = { col:0, box:1, mark:{ col:0, box:1, tick:true } };
    marks[first].push(cur[first].mark);
    let lastEvent = 'serve';
    for (let i=0; i<log.length; i++) {
      const ev = log[i];
      const scorer = ev.t;
      if (scorer === servingTeam) { lastEvent = 'hold'; continue; }
      // side-out: serving team lost service — write its points in its ticked box
      const loserScore = servingTeam==='A' ? (ev.a - 0) : (ev.b - 0);
      // serving team's score did not change on this rally: its score = current log values for that team
      const sScore = servingTeam==='A' ? ev.a : ev.b;
      if (cur[servingTeam]) cur[servingTeam].mark.score = sScore;
      // new serving team
      servingTeam = scorer;
      if (!served[servingTeam]) {
        served[servingTeam] = true;
        // X cancels box 1 col I, then tick box 1 col II
        marks[servingTeam].push({ col:0, box:1, x:true });
        usage[servingTeam][1] = 1;
        cur[servingTeam] = { col:1, box:1, mark:{ col:1, box:1, tick:true } };
      } else {
        const ncol = (cur[servingTeam].col + 1) % 6;
        usage[servingTeam][ncol]++;
        const nbox = Math.min(usage[servingTeam][ncol], boxesPerCol);
        cur[servingTeam] = { col:ncol, box:nbox, mark:{ col:ncol, box:nbox, tick:true } };
      }
      marks[servingTeam].push(cur[servingTeam].mark);
      lastEvent = 'sideout';
    }
    // set end: circle final point
    if (log.length) {
      const lastScorer = log[log.length-1].t;
      const finalScore = lastScorer==='A' ? log[log.length-1].a : log[log.length-1].b;
      if (lastEvent === 'hold' || lastScorer === servingTeam) {
        // server won final rally: circled score in its current ticked box
        if (cur[lastScorer]) { cur[lastScorer].mark.score = finalScore; cur[lastScorer].mark.circled = true; }
      } else if (lastEvent === 'sideout') {
        // receiving team won set: score in would-be box WITHOUT tick
        if (cur[lastScorer]) { cur[lastScorer].mark.tick = false; cur[lastScorer].mark.score = finalScore; cur[lastScorer].mark.circled = true; }
      }
    }
    return marks;
  }

  // ── set duration with fallback to matchSummary event clock times ──
  function setDur(sd, si) {
    const d = DM(sd && sd.startTime, sd && sd.endTime);
    if (d > 0) return d;
    const evs = (gameData.matchSummary||[]).filter(e => e.type==='Pt' && e.setNumber===si+1 && e.time);
    if (evs.length >= 2) {
      function secs(t){ const p=String(t).split(':').map(Number); return p[0]*3600+(p[1]||0)*60+(p[2]||0); }
      let s = secs(evs[evs.length-1].time) - secs(evs[0].time);
      if (s < 0) s += 86400;
      return Math.max(1, Math.round(s/60));
    }
    return d;
  }

  // ── point log: per-set rally sequence (rallyLog preferred, matchSummary fallback) ──
  function pointLog(sd, si) {
    if (sd.rallyLog && sd.rallyLog.length) return sd.rallyLog.slice();
    const evs = (gameData.matchSummary||[]).filter(e => e.type==='Pt' && e.setNumber===si+1);
    const log = []; let a=0, b=0;
    for (const e of evs) {
      const m = /Score:\s*(\d+)-(\d+)/.exec(e.description||'');
      if (!m) continue;
      const x=+m[1], y=+m[2];
      if (x===a+1 && y===b) { log.push('A'); a=x; b=y; }
      else if (x===a && y===b+1) { log.push('B'); a=x; b=y; }
      else if (x<=a && y<=b) { /* undo artifact duplicate — skip */ }
      else { a=x; b=y; } // resync (rare)
    }
    return log;
  }

  // ── FIVB service-round recorder for SET panels 1-4 ────────────────
  // Box b (1-8) in position column i: sub-col = b<=4?0:1, row = (b-1)%4
  function srBoxCenter(sideX, i, b, dx, dy) {
    const sub = b<=4 ? 0 : 1, row = (b-1)%4;
    return [ sideX + i*11.068 + sub*5.534 + 2.767 + dx,
             76.65 + row*5.16 + 2.58 + dy ];
  }
  function srTick(cx, cy) { // small check mark, tucked in the top-right corner
    LN(cx+0.7, cy-1.3, cx+1.1, cy-0.9, 0.35);
    LN(cx+1.1, cy-0.9, cx+1.9, cy-2.1, 0.35);
  }
  function serviceRounds(sd, si, lT, dx, dy) {
    const rT = lT==='A' ? 'B' : 'A';
    const first = sd.firstServer || sd.serving;
    if (!first) return;
    const log = pointLog(sd, si);
    const sideX = t => (t===lT ? 65.792 : 148.409);
    const st = { A:{nextCol:0,used:[0,0,0,0,0,0],aCol:-1,aBox:0,lwCol:-1,lwBox:0,lwPts:-1}, B:{nextCol:0,used:[0,0,0,0,0,0],aCol:-1,aBox:0,lwCol:-1,lwBox:0,lwPts:-1} };
    let serving = first;
    const recv = serving==='A' ? 'B' : 'A';
    // serving team: tick box 1 of column I
    st[serving].used[0]=1; st[serving].aCol=0; st[serving].aBox=1; st[serving].nextCol=1;
    { const [cx,cy]=srBoxCenter(sideX(serving),0,1,dx,dy); srTick(cx,cy); }
    // receiving team: X box 1 of column I (consumed), first serve will be column II
    st[recv].used[0]=1; st[recv].nextCol=1;
    { const [cx,cy]=srBoxCenter(sideX(recv),0,1,dx,dy); XM(cx,cy,1.6); }
    const pts={A:0,B:0};
    for (const t of log) {
      pts[t]++;
      if (t!==serving) {
        // side-out: write serving team's points into their active box
        if (st[serving].aCol>=0) {
          const [cx,cy]=srBoxCenter(sideX(serving),st[serving].aCol,st[serving].aBox,dx,dy);
          T(String(pts[serving]), cx, cy+1.7, 7, true, 'C');
          st[serving].lwCol=st[serving].aCol; st[serving].lwBox=st[serving].aBox; st[serving].lwPts=pts[serving];
        }
        serving = t;
        const cN = st[t].nextCol;
        const bN = st[t].used[cN]+1;
        if (bN<=8) {
          st[t].used[cN]=bN; st[t].aCol=cN; st[t].aBox=bN;
          const [cx,cy]=srBoxCenter(sideX(t),cN,bN,dx,dy); srTick(cx,cy);
        }
        st[t].nextCol=(cN+1)%6;
      }
    }
    // set end: circle last server's points; other team's points in would-be box, no tick
    if (sd.winner && log.length) {
      if (st[serving].aCol>=0) {
        const [cx,cy]=srBoxCenter(sideX(serving),st[serving].aCol,st[serving].aBox,dx,dy);
        T(String(pts[serving]), cx, cy+1.7, 7, true, 'C');   // the game point
        CIRC(cx, cy+0.1, 2.2, 0.5);
      }
      const o = serving==='A' ? 'B' : 'A';
      if (st[o].lwCol>=0 && st[o].lwPts===pts[o]) {
        // points unchanged since their last side-out entry: circle the EXISTING entry (no duplicate)
        const [cx,cy]=srBoxCenter(sideX(o),st[o].lwCol,st[o].lwBox,dx,dy);
        CIRC(cx, cy+0.1, 2.2, 0.5);
      } else {
        const cN = st[o].nextCol, bN = st[o].used[cN]+1;
        if (bN<=8 && pts[o]>0) {
          const [cx,cy]=srBoxCenter(sideX(o),cN,bN,dx,dy);
          T(String(pts[o]), cx, cy+1.7, 7, true, 'C');
          CIRC(cx, cy+0.1, 2.2, 0.5);
        }
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // HEADER (top of page)
  // ══════════════════════════════════════════════════════════════════
  T(mi.competition||'', 62, 17.4, 11, true);
  T(mi.city||mi.venue||'', 30, 24.9, 9, true);                          // City box 26.6-106
  T(mi.countryCode||'', 148.5, 24.8, 9, true, 'C');                     // Country Code box 140-157
  // Date split as DD / MM / YYYY under the printed D, M, Y markers
  (function(){
    const ds = String(mi.date||mi.matchDate||'');
    let dd='', mm2='', yy='';
    let m1 = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(ds);
    if (m1) { yy=m1[1]; mm2=('0'+m1[2]).slice(-2); dd=('0'+m1[3]).slice(-2); }
    else {
      let m2 = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/.exec(ds);
      if (m2) { dd=('0'+m2[1]).slice(-2); mm2=('0'+m2[2]).slice(-2); yy=m2[3]; }
    }
    if (dd) {
      T(dd, 176, 24.8, 8.5, true, 'C');    // under D (174.9)
      T(mm2, 187, 24.8, 8.5, true, 'C');   // under M (185.8)
      T(yy, 199.3, 24.8, 8.5, true, 'C');  // under Y (197.6)
    } else if (ds) T(ds, 187, 24.8, 8.5, true, 'C');
  })();
  T(mi.time||mi.matchTime||'', 231.4, 24.8, 8.5, true, 'C');            // Time box 220-242.7
  T(mi.hall||'', 30, 30.7, 9, true);                                    // Hall box
  T(mi.pool||'', 114.5, 30.6, 8.5, true, 'C');                          // Pool/Phase box 106-123
  T(String(mi.matchNumber||mi.matchNo||''), 151.3, 30.6, 8, true, 'C'); // Match N° box 145.6-157
  // Division / Category X marks (checkbox left of each word)
  const div=(mi.division||'').toLowerCase(), cat=(mi.category||'').toLowerCase();
  if (div.includes('men') && !div.includes('women')) XM(42.97, 36.42, 1.7);
  if (div.includes('women')) XM(65.08, 36.31, 1.7);
  if (cat.includes('senior')) XM(112.80, 36.25, 1.7);
  if (cat.includes('junior')) XM(133.75, 36.25, 1.7);
  if (cat.includes('youth')) XM(153.87, 36.42, 1.7);
  // TEAMS box (official style, Fig.7): code spaced in 3-cell box, letter in big circle
  function spacedCode(code, centers, ybase, size) {
    const cs = String(code||'').slice(0,3).split('');
    if (cs.length===3) cs.forEach((ch,i)=>T(ch, centers[i], ybase, size, true, 'C'));
    else T(code, centers[1], ybase, size, true, 'C');
  }
  spacedCode(abA, [177.9,183.55,189.2], 36.6, 10.5);   // Team A name box (175.1-192.0)
  T('A', 169.4, 36.9, 11.5, true, 'C');                // letter A in left big circle (c 169.4,34.3)
  spacedCode(abB, [216.15,221.8,227.45], 36.6, 10.5);  // Team B name box (213.3-230.3)
  T('B', 236.2, 36.8, 11.5, true, 'C');                // letter B in right big circle

  // ══════════════════════════════════════════════════════════════════
  // SET PANELS 1-4
  // panel geometry: left half base x=0; right half +176.334; row2 +57.28
  // ══════════════════════════════════════════════════════════════════
  const DXP = 176.334, DYR = 57.28;

  function panel(si, lT, dx, dy) {
    const rT = lT==='A' ? 'B' : 'A';
    const lAb = lT==='A' ? abA : abB, rAb = lT==='A' ? abB : abA;
    const sd = sets[si] || null;
    if (!sd) return;
    const srv = sd.serving || lT;
    const luL = sd['lineup'+lT] || [], luR = sd['lineup'+rT] || [];
    const subsL = (sd.substitutions||{})[lT] || [], subsR = (sd.substitutions||{})[rT] || [];
    const toL = (sd.timeouts||{})[lT] || [], toR = (sd.timeouts||{})[rT] || [];
    const scL = (sd.score||{})[lT] || 0, scR = (sd.score||{})[rT] || 0;

    // times inside the START box (77.0-87.3) and END box (202.5-213.8)
    const st = sd.startTime, et = sd.endTime;
    if (st) { T(FTh(st), 79.5+dx, 45.6+dy, 7.5, true, 'C'); T(FTm(st), 85.0+dx, 45.6+dy, 7.5, true, 'C'); }
    if (et) { T(FTh(et), 205.2+dx, 45.6+dy, 7.5, true, 'C'); T(FTm(et), 211.3+dx, 45.6+dy, 7.5, true, 'C'); }

    // team codes spaced in the 3-cell name boxes: left (100.6-117.5), right (163.1-180.0)
    spacedCode(lAb, [103.4+dx,109.05+dx,114.7+dx], 46.6+dy, 9.5);
    spacedCode(rAb, [165.9+dx,171.55+dx,177.2+dx], 46.6+dy, 9.5);

    // serve/receive X marks over S/R circles (based on FIRST server of the set)
    const fs0 = sd.firstServer || sd.serving;
    if (fs0 === lT) { XM(129.65+dx, 43.05+dy); XM(151.05+dx, 46.7+dy); }
    else            { XM(151.05+dx, 43.05+dy); XM(129.65+dx, 46.7+dy); }

    // full FIVB service-round record (ticks, round scores, X, final circles)
    serviceRounds(sd, si, lT, dx, dy);

    // starting lineup (E row): col centers 65.792+5.534+i*11.068 (left), 148.409+... (right)
    for (let i=0;i<6;i++) {
      const cxL = 65.792+5.534+i*11.068+dx, cxR = 148.409+5.534+i*11.068+dx;
      if (luL[i]) T(String(luL[i]), cxL, 60.7+dy, 10.5, true, 'C');
      if (luR[i]) T(String(luR[i]), cxR, 60.7+dy, 10.5, true, 'C');
    }
    // substitutes (T row): column = starting-lineup position of the player going out.
    // If the original player returns, the substitute's number is CIRCLED and the
    // second score goes in the LOWER score box (FIVB rule 3.6.c/d).
    function drawSubs(subs, lu, sideX2, teamKey, oppKey) {
      subs.forEach((sub, k) => {
        if (!sub || !sub.playerIn) return;
        let col = lu.findIndex(v => String(v) === String(sub.playerOut));
        let isReturn = false;
        if (col < 0) {
          // playerOut was himself a substitute → the starter is coming back
          for (let j = 0; j < k; j++) {
            const p = subs[j];
            if (p && String(p.playerIn) === String(sub.playerOut)) {
              col = lu.findIndex(v => String(v) === String(p.playerOut));
              isReturn = true;
              break;
            }
          }
        }
        if (col < 0) return;
        const cx = sideX2 + 5.534 + col*11.068 + dx;
        const sc = sub.score || {};
        if (!isReturn) {
          T(String(sub.playerIn), cx, 65.8+dy, 9, true, 'C');
          T(String(sc[teamKey]||0), cx-0.7, 68.9+dy, 6, false, 'R');
          T(String(sc[oppKey]||0),  cx+1.3, 68.9+dy, 6, false);
        } else {
          CIRC(cx, 64.1+dy, 2.4, 0.45);  // circle the substitute's number
          T(String(sc[teamKey]||0), cx-0.7, 74.25+dy, 6.8, false, 'R');
          T(String(sc[oppKey]||0),  cx+1.3, 74.25+dy, 6.8, false);
        }
      });
    }
    drawSubs(subsL, luL, 65.792, lT, rT);
    drawSubs(subsR, luR, 148.409, rT, lT);

    // timeouts: written around the pre-printed ':' in the "T" column under POINTS
    // left team colons at (140.1, 88.6) & (140.1, 94.05); right team at (222.7, ...)
    function toEntry(cx, cy, s1, s2) {
      T(String(s1), cx-1.0, cy+1.5, 7.5, true, 'R');
      T(String(s2), cx+1.2, cy+1.5, 7.5, true);
    }
    toL.slice(0,2).forEach((to,ti)=>{
      const sc=to.score||{};
      toEntry(140.1+dx, (ti===0?88.6:94.05)+dy, sc[lT]||0, sc[rT]||0);
    });
    toR.slice(0,2).forEach((to,ti)=>{
      const sc=to.score||{};
      toEntry(222.7+dx, (ti===0?88.6:94.05)+dy, sc[rT]||0, sc[lT]||0);
    });

    // POINTS slashes: left col x=132.204, right x=214.82; cell 4.086 x 2.66
    function slashes(px, sc, done) {
      for (let pn=1; pn<=Math.min(sc,48); pn++) {
        const c=Math.floor((pn-1)/12), r=(pn-1)%12;
        const xl = px + c*4.086 + dx;
        const yt = 49.05 + r*2.66 + dy;
        LN(xl+0.55, yt+2.45, xl+3.55, yt+0.35, 0.5, rgb(0.05,0.05,0.35));
      }
      if (sc>0 && sc<=48) { // circle final point
        const c=Math.floor((sc-1)/12), r=(sc-1)%12;
        CIRC(px + c*4.086 + 2.04 + dx, 49.05 + r*2.66 + 1.42 + dy, 1.75, 0.5);
      }
      if (done) { // FIVB 3.4.f: cancel unused numbers — tall X per column segment
        for (let col=0; col<4; col++) {
          const first = Math.max(sc+1, col*12+1), last = (col+1)*12;
          if (first > last) continue;
          const xl = px + col*4.086 + dx;
          const yT = 49.05 + ((first-1)%12)*2.66 + dy + 0.25;
          const yB = 49.05 + ((last-1)%12)*2.66 + 2.66 + dy - 0.25;
          LN(xl+0.45, yT, xl+3.65, yB, 0.55);
          LN(xl+3.65, yT, xl+0.45, yB, 0.55);
          LN(xl+0.45, yT, xl+3.65, yT, 0.55);   // closed at top
          LN(xl+0.45, yB, xl+3.65, yB, 0.55);   // closed at bottom
        }
      }
    }
    slashes(132.204, scL, !!sd.winner);
    slashes(214.82, scR, !!sd.winner);
  }

  panel(0, 'A', 0, 0);
  panel(1, 'B', DXP, 0);
  panel(2, 'A', 0, DYR);
  panel(3, 'B', DXP, DYR);

  // ══════════════════════════════════════════════════════════════════
  // SET 5
  // ══════════════════════════════════════════════════════════════════
  const sd5 = sets[4] || null;
  if (sd5) {
    const srv5 = sd5.firstServer || sd5.serving || 'A';
    const lu5A = sd5.lineupA || [], lu5B = sd5.lineupB || [];
    const to5A = (sd5.timeouts||{}).A || [], to5B = (sd5.timeouts||{}).B || [];
    const sc5A = (sd5.score||{}).A || 0, sc5B = (sd5.score||{}).B || 0;
    const st5t = sd5.startTime, et5t = sd5.endTime;
    // times inside boxes: START (81.5-91.8), END (202.5-213.8)
    if (st5t) { T(FTh(st5t), 84.0, 160.6, 7.5, true, 'C'); T(FTm(st5t), 89.5, 160.6, 7.5, true, 'C'); }
    if (et5t) { T(FTh(et5t), 205.0, 160.5, 7.5, true, 'C'); T(FTm(et5t), 210.5, 160.5, 7.5, true, 'C'); }
    // sec1: code spaced in name box (105.0-122.0) + letter A in circle (c 128.25,160.0)
    spacedCode(abA, [107.8,113.5,119.2], 161.6, 9.5);
    T('A', 128.25, 161.6, 10, true, 'C');
    // sec2: code spaced in name box (163.1-180.0) + letter B in circle (c 156.85,160.0)
    spacedCode(abB, [165.9,171.55,177.2], 161.6, 9.5);
    T('B', 156.85, 161.5, 10, true, 'C');
    // sec3 after change of court: letter only, in the circle (c 259.8,160.0)
    T('A', 259.8, 161.6, 10.5, true, 'C');
    if (srv5==='A') { XM(134.1, 158.2); XM(151.0, 161.9); }
    else            { XM(151.0, 158.2); XM(134.1, 161.9); }
    for (let i=0;i<6;i++) {
      if (lu5A[i]) { T(String(lu5A[i]), 76.0+i*11.068, 175.4, 10.5, true, 'C');
                     T(String(lu5A[i]), 247.54+i*11.068, 175.4, 10.5, true, 'C'); }
      if (lu5B[i]) T(String(lu5B[i]), 153.94+i*11.068, 175.4, 10.5, true, 'C');
    }
    function to5Entry(cx, cy, s1, s2) {
      T(String(s1), cx-1.0, cy+1.5, 7.5, true, 'R');
      T(String(s2), cx+1.2, cy+1.5, 7.5, true);
    }
    to5A.slice(0,2).forEach((to,ti)=>{ const sc=to.score||{};
      to5Entry(142.6, ti===0?199.28:204.75, sc.A||0, sc.B||0); });
    to5B.slice(0,2).forEach((to,ti)=>{ const sc=to.score||{};
      to5Entry(222.5, ti===0?199.28:204.75, sc.B||0, sc.A||0); });

    // ── SET5 point slashes ─────────────────────────────────────────
    // team A pre-change: single col 1-8; team B: 3x10 grid mid; team A post-change: 3x10 far right
    const log5 = pointLog(sd5, 4);
    // find change moment (leading team reaches 8) and A's points at change
    let cA=0, cB=0, changeIdx=-1, ptsAtChange=null;
    for (let i=0;i<log5.length;i++) {
      if (log5[i]==='A') cA++; else cB++;
      if (changeIdx<0 && (cA===8||cB===8)) { changeIdx=i; ptsAtChange=cA+':'+cB; }
    }
    if (ptsAtChange==null && (sc5A>=8||sc5B>=8)) ptsAtChange=Math.min(sc5A,8)+':'+Math.min(sc5B,8);
    if (ptsAtChange!=null) T(ptsAtChange, 299.55, 161.6, 9, true, 'C');
    const preA = changeIdx>=0 ? Math.min(cAatIdx(log5,changeIdx),8) : Math.min(sc5A,8);
    function cAatIdx(lg,idx){ let n=0; for(let i=0;i<=idx;i++) if(lg[i]==='A') n++; return n; }
    for (let pn=1; pn<=Math.min(preA,8); pn++) {
      const yc = 165.81 + (pn-1)*3.325;
      LN(140.9, yc+1.3, 143.8, yc-1.3, 0.5);
    }
    if (sc5A>0 && sc5A<=preA) CIRC(142.33, 165.81+(sc5A-1)*3.325, 1.8, 0.5);
    if (sd5.winner && preA < 8) { // cancel unused 1-8 column
      const yT = 165.81 + preA*3.325 - 1.4, yB = 165.81 + 7*3.325 + 1.4;
      LN(140.7, yT, 144.0, yB, 0.55); LN(144.0, yT, 140.7, yB, 0.55);
      LN(140.7, yT, 144.0, yT, 0.55); LN(140.7, yB, 144.0, yB, 0.55);
    }
    function slash30(px, from, to, circleAt, cancelAfter) {
      for (let pn=from; pn<=Math.min(to,30); pn++) {
        const cc=Math.floor((pn-1)/10), rr=(pn-1)%10;
        const xl=px+cc*5.45, yt=164.45+rr*2.66;
        LN(xl+0.6, yt+2.35, xl+4.7, yt+0.3, 0.5);
      }
      if (circleAt>=1 && circleAt<=30) {
        const cc=Math.floor((circleAt-1)/10), rr=(circleAt-1)%10;
        CIRC(px+cc*5.45+2.6, 164.45+rr*2.66+1.35, 1.8, 0.5);
      }
      if (cancelAfter!=null) { // tall X over unused numbers per column
        for (let col=0; col<3; col++) {
          const first = Math.max(cancelAfter+1, col*10+1), last = (col+1)*10;
          if (first > last) continue;
          const xl = px + col*5.45;
          const yT = 164.45 + ((first-1)%10)*2.66 + 0.25;
          const yB = 164.45 + ((last-1)%10)*2.66 + 2.66 - 0.25;
          LN(xl+0.55, yT, xl+4.75, yB, 0.55);
          LN(xl+4.75, yT, xl+0.55, yB, 0.55);
          LN(xl+0.55, yT, xl+4.75, yT, 0.55);
          LN(xl+0.55, yB, xl+4.75, yB, 0.55);
        }
      }
    }
    slash30(214.9, 1, sc5B, sc5B, sd5.winner ? sc5B : null);
    if (sc5A>preA) slash30(308.57, preA+1, sc5A, sc5A, sd5.winner ? sc5A : null);
    else if (sd5.winner) slash30(308.57, 1, 0, 0, 0); // team A never changed: cancel whole right grid

    // ── SET5 service rounds: 6 boxes (2 sub-cols x 3 rows) per column ──
    function s5Box(base, i, b) {
      const sub = b<=3 ? 0 : 1, row = (b-1)%3;
      return [ base + i*11.068 + sub*5.534 + 2.767, 191.94 + row*5.18 + 2.6 ];
    }
    const secA1 = 70.471, secB = 148.343, secA2 = 242.008;
    const s5 = { A:{nextCol:0,used:[0,0,0,0,0,0],aCol:-1,aBox:0,lwCol:-1,lwBox:0,lwPts:-1,lwBase:0}, B:{nextCol:0,used:[0,0,0,0,0,0],aCol:-1,aBox:0,lwCol:-1,lwBox:0,lwPts:-1,lwBase:0} };
    let sv = srv5, changed=false, pA=0, pB=0;
    const rc5 = sv==='A' ? 'B' : 'A';
    function baseFor(t){ return t==='B' ? secB : (changed ? secA2 : secA1); }
    s5[sv].used[0]=1; s5[sv].aCol=0; s5[sv].aBox=1; s5[sv].nextCol=1;
    { const [cx,cy]=s5Box(baseFor(sv),0,1); srTick(cx,cy); }
    s5[rc5].used[0]=1; s5[rc5].nextCol=1;
    { const [cx,cy]=s5Box(baseFor(rc5),0,1); XM(cx,cy,1.5); }
    for (const t of log5) {
      if (t==='A') pA++; else pB++;
      if (!changed && (pA===8||pB===8)) changed=true;
      if (t!==sv) {
        if (s5[sv].aCol>=0) {
          const [cx,cy]=s5Box(baseFor(sv),s5[sv].aCol,s5[sv].aBox);
          T(String(sv==='A'?pA:pB), cx, cy+1.7, 7, true, 'C');
          s5[sv].lwCol=s5[sv].aCol; s5[sv].lwBox=s5[sv].aBox; s5[sv].lwPts=(sv==='A'?pA:pB); s5[sv].lwBase=baseFor(sv);
        }
        sv = t;
        const cN=s5[t].nextCol, bN=s5[t].used[cN]+1;
        if (bN<=6) {
          s5[t].used[cN]=bN; s5[t].aCol=cN; s5[t].aBox=bN;
          const [cx,cy]=s5Box(baseFor(t),cN,bN); srTick(cx,cy);
        }
        s5[t].nextCol=(cN+1)%6;
      }
    }
    if (sd5.winner && log5.length) {
      if (s5[sv].aCol>=0) {
        const [cx,cy]=s5Box(baseFor(sv),s5[sv].aCol,s5[sv].aBox);
        T(String(sv==='A'?pA:pB), cx, cy+1.7, 7, true, 'C');   // the game point
        CIRC(cx, cy+0.1, 2.2, 0.5);
      }
      const o = sv==='A'?'B':'A';
      const oPts = o==='A'?pA:pB;
      if (s5[o].lwCol>=0 && s5[o].lwPts===oPts) {
        const [cx,cy]=s5Box(s5[o].lwBase,s5[o].lwCol,s5[o].lwBox);
        CIRC(cx, cy+0.1, 2.2, 0.5);   // circle existing entry, no duplicate
      } else {
        const cN=s5[o].nextCol, bN=s5[o].used[cN]+1;
        if (bN<=6 && oPts>0) {
          const [cx,cy]=s5Box(baseFor(o),cN,bN);
          T(String(oPts), cx, cy+1.7, 7, true, 'C');
          CIRC(cx, cy+0.1, 2.2, 0.5);
        }
      }
    }

  }

  // ══════════════════════════════════════════════════════════════════
  // ROSTER (right FIVB block) + LIBEROS + COACHES + SIGNATURE names
  // ══════════════════════════════════════════════════════════════════
  // Second TEAMS assignment box (above the roster): codes in boxes, letters in circles
  spacedCode(abA, [343.6,349.3,355.0], 161.4, 8);
  T('A', 332.8, 161.7, 9.5, true, 'C');
  spacedCode(abB, [377.6,383.3,389.0], 161.4, 8);
  T('B', 401.6, 161.7, 9.5, true, 'C');

  const rY0 = 170.9, rH = 4.15;   // baseline centered in each printed row
  function libTag(p){ return p.role==='libero1' ? ' (L1)' : (p.role==='libero2' ? ' (L2)' : (p.role==='captain' ? ' (C)' : '')); }
  plA.slice(0,14).forEach((p,i)=>{
    const yb = rY0 + i*rH;
    T(String(p.jersey||''), 334.2, yb, 6.5, p.role==='captain', 'C');
    if (p.role==='captain') CIRC(334.2, yb-1.4, 2.8, 0.4);
    T((p.name||'').slice(0,15) + libTag(p), 339, yb, 6, false, 'L');
  });
  plB.slice(0,14).forEach((p,i)=>{
    const yb = rY0 + i*rH;
    T(String(p.jersey||''), 374.6, yb, 6.5, p.role==='captain', 'C');
    if (p.role==='captain') CIRC(374.6, yb-1.4, 2.8, 0.4);
    T((p.name||'').slice(0,15) + libTag(p), 379, yb, 6, false, 'L');
  });
  const libsA = plA.filter(p=>p.role && p.role.indexOf('libero')===0);
  const libsB = plB.filter(p=>p.role && p.role.indexOf('libero')===0);
  libsA.slice(0,2).forEach((p,i)=> T('L'+(i+1)+' #'+p.jersey+' '+(p.name||'').slice(0,11), 330, 237.5+i*4.2, 6));
  libsB.slice(0,2).forEach((p,i)=> T('L'+(i+1)+' #'+p.jersey+' '+(p.name||'').slice(0,11), 372, 237.5+i*4.2, 6));
  // OFFICIALS table: left cell x 327-363 (center 345), right cell 371.5-407.5 (center 389.5)
  // Rows: C 245.5-249.7, AC1 249.7-253.9, AC2 253.9-258.1, T 258.1-262.3, M 262.3-266.5
  const offRows = [
    [off.coachA,     off.coachB,     249.2],
    [off.asstCoachA, off.asstCoachB, 253.4],
    [null,           null,           257.6],
    [off.trainerA,   off.trainerB,   261.8],
    [off.medicalA,   off.medicalB,   266.0]
  ];
  offRows.forEach(([va,vb,yb])=>{
    if (va) T(String(va).slice(0,22), 345, yb, 5.5, false, 'C');
    if (vb) T(String(vb).slice(0,22), 389.5, yb, 5.5, false, 'C');
  });

  // Signature images (canvas dataURLs from the app's Officials screen)
  const sigs = off.signatures || {};
  async function SIG(dataUrl, xmm, ymmTop, wmm, hmm) {
    try {
      if (!dataUrl || typeof dataUrl !== 'string' || dataUrl.length < 1000) return; // skip blank pads
      const img = await pdf.embedPng(dataUrl);
      page.drawImage(img, { x: xmm*K, y: (PH - ymmTop - hmm)*K, width: wmm*K, height: hmm*K });
    } catch(e) {}
  }
  // SIGNATURES box (right column): Team Captain row ~270-280, Coach row ~280-289.5
  await SIG(sigs.captainSignA1, 346, 271.0, 19, 7.5);
  await SIG(sigs.captainSignB1, 386, 271.0, 19, 7.5);
  await SIG(sigs.coachSignA,    337, 283.6, 19, 5.4);
  await SIG(sigs.coachSignB,    377, 283.2, 19, 5.4);

  // ══════════════════════════════════════════════════════════════════
  // APPROVAL (referee names)
  // ══════════════════════════════════════════════════════════════════
  // Rows: 1st 249.9-255.4 / 2nd 255.9-261.3 / Scorer 261.5-266.2 / Asst 266.7-272.4
  T(mi.ref1||'', 100, 254.4, 8.5, true);
  T(mi.ref2||'', 100, 260.3, 8.5, true);
  T(mi.scorer||'', 100, 265.4, 8.5, true);
  T(mi.assistScorer||'', 100, 271.3, 8.5, true);
  // Team Captain signatures in the approval bottom row (A ... Team Captains ... B)
  await SIG(sigs.captainSignA2 || sigs.captainSignA1, 96, 282.6, 42, 5.6);
  await SIG(sigs.captainSignB2 || sigs.captainSignB1, 176, 282.6, 42, 5.6);
  await SIG(sigs.firstRefSign,    210, 250.4, 26, 4.6);
  await SIG(sigs.secondRefSign,   210, 256.2, 26, 4.6);
  await SIG(sigs.scorerSign,      210, 261.8, 26, 4.2);
  await SIG(sigs.assistScorerSign,210, 267.4, 26, 4.4);

  // ══════════════════════════════════════════════════════════════════
  // SANCTIONS rows
  // ══════════════════════════════════════════════════════════════════
  const sanctions = [];
  Object.entries(gameData.sanctions||{}).forEach(([t,arr])=>(arr||[]).forEach(s=>sanctions.push([s,t])));
  sanctions.slice(0,8).forEach(([s,t],i)=>{
    const yb = 232.3 + i*4.205;            // printed rows: ':' centers at 230.8 + i*4.205
    const ty = s.type||'';
    let colx, mark;
    if (ty==='delay')                        { colx=15.9; mark='D'; }
    else if (ty==='delay_penalty')           { colx=24.6; mark='D'; }
    else if (ty==='misconduct_warning')      { colx=15.9; mark=(s.player&&s.player!=='Team')?String(s.player):'T'; }
    else if (ty==='misconduct_penalty')      { colx=24.6; mark=(s.player&&s.player!=='Team')?String(s.player):'T'; }
    else if (ty==='misconduct_expulsion')    { colx=33.6; mark=(s.player&&s.player!=='Team')?String(s.player):'T'; }
    else                                     { colx=42.5; mark=(s.player&&s.player!=='Team')?String(s.player):'T'; }
    T(mark, colx, yb, 7.5, true, 'C');
    T(t, 49.3, yb, 7.5, true, 'C');
    T(String(s.set||s.setNumber||''), 56.4, yb, 7.5, false, 'C');
    const sc = s.score||{};
    T(String(sc.A!=null?sc.A:''), 67.95, yb, 7, false, 'R');
    T(String(sc.B!=null?sc.B:''), 69.85, yb, 7, false);
  });

  // REMARKS
  const rem = gameData.remarks || '';
  if (rem) {
    const words = rem.split(' '); let lines=[], cur='';
    words.forEach(w=>{ if((cur+' '+w).trim().length<=52){cur=(cur+' '+w).trim();} else {lines.push(cur);cur=w;} });
    if (cur) lines.push(cur);
    lines.slice(0,4).forEach((ln,i)=> T(ln, 71, 219.5+i*4.6, 5));
  }

  // ══════════════════════════════════════════════════════════════════
  // RESULTS TABLE
  // ══════════════════════════════════════════════════════════════════
  // Fig.7 style: codes spaced in name boxes (257.9-274.9 / 295.5-312.5), A/B in circles
  spacedCode(abA, [260.75,266.4,272.05], 222.9, 7.5);
  T('A', 280.45, 223.6, 9, true, 'C');
  T('B', 290.4, 223.6, 9, true, 'C');
  spacedCode(abB, [298.35,304.0,309.65], 222.9, 7.5);
  let tWA=0,tWB=0,tPA=0,tPB=0,tSA=0,tSB=0,tTA=0,tTB=0,tDur=0;
  const rowY = [237.2, 244.4, 251.5, 258.7, 265.8];
  for (let si=0; si<5; si++) {
    const sd = sets[si]; if (!sd) continue;
    const sc = sd.score||{}, pA=sc.A||0, pB=sc.B||0;
    const wA = sd.winner==='A'?1:0, wB = sd.winner==='B'?1:0;
    const sA=((sd.substitutions||{}).A||[]).length, sB=((sd.substitutions||{}).B||[]).length;
    const tA2=((sd.timeouts||{}).A||[]).length, tB2=((sd.timeouts||{}).B||[]).length;
    const dur = setDur(sd, si);
    tWA+=wA;tWB+=wB;tPA+=pA;tPB+=pB;tSA+=sA;tSB+=sB;tTA+=tA2;tTB+=tB2;tDur+=dur;
    const yb = rowY[si];
    T(String(tA2), 249.6, yb, 7.2, true, 'C');
    T(String(sA), 255.9, yb, 7.2, true, 'C');
    T(String(wA), 262.6, yb, 7.2, true, 'C');
    T(String(pA), 269.9, yb, 7.2, true, 'C');
    T(String(dur), 288.7, yb, 7.5, true, 'C');   // inside printed ( ) at 281.6-295.8
    T(String(pB), 300.7, yb, 7.2, true, 'C');
    T(String(wB), 307.9, yb, 7.2, true, 'C');
    T(String(sB), 314.3, yb, 7.2, true, 'C');
    T(String(tB2), 320.9, yb, 7.2, true, 'C');
  }
  // totals row
  T(String(tTA), 249.6, 271.4, 7.2, true, 'C');
  T(String(tSA), 255.9, 271.4, 7.2, true, 'C');
  T(String(tWA), 262.6, 271.4, 7.2, true, 'C');
  T(String(tPA), 269.9, 271.4, 7.2, true, 'C');
  T(String(tDur), 282.5, 273.2, 7.5, true, 'C');   // inside printed ( ... mn )
  T(String(tPB), 300.7, 271.4, 7.2, true, 'C');
  T(String(tWB), 307.9, 271.4, 7.2, true, 'C');
  T(String(tSB), 314.3, 271.4, 7.2, true, 'C');
  T(String(tTB), 320.9, 271.4, 7.2, true, 'C');
  // match times
  const mStart = gameData.startTime || (sets[0] && sets[0].startTime);
  const mEnd = sets.length ? sets[sets.length-1].endTime : null;
  // values written on the dotted lines BEFORE the printed h / mn
  if (mStart) { T(FTh(mStart), 253.3, 281.5, 8.5, true, 'R'); T(FTm(mStart), 262.0, 281.5, 8.5, true, 'R'); }
  if (mEnd)   { T(FTh(mEnd),   280.1, 281.3, 8.5, true, 'R'); T(FTm(mEnd),   288.8, 281.3, 8.5, true, 'R'); }
  const mDur = DM(mStart, mEnd) || tDur;   // total match duration = ending - starting
  const th = Math.floor(mDur/60), tm = mDur%60;
  T(String(th), 307.5, 281.2, 8.5, true, 'R'); T(String(tm), 316.2, 281.2, 8.5, true, 'R');
  // winner
  const winner = tWA>=3 ? tA : (tWB>=3 ? tB : '');
  if (winner) {
    // winner code spaced in the printed 3-cell box (276.8-293.7); loser sets after printed "3 :"
    spacedCode(tWA>=3?abA:abB, [279.6,285.2,290.8], 287.9, 9);
    T(String(Math.min(tWA,tWB)), 316.5, 288.4, 10, true);
  }

  return await pdf.save();
}
