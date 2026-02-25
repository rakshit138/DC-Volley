import { useRef, useEffect, useState } from 'react';
import './OfficialsModal.css';

function useSignatureCanvas(initialDataUrl, signatureKey, onSignatureChange, isOpen) {
  const ref = useRef(null);
  const [ctx, setCtx] = useState(null);
  const drawing = useRef(false);
  const onSignatureChangeRef = useRef(onSignatureChange);
  onSignatureChangeRef.current = onSignatureChange;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const c = canvas.getContext('2d');
    if (!c) return;
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, canvas.width, canvas.height);
    setCtx(c);
    if (initialDataUrl && initialDataUrl.length > 50) {
      const img = new Image();
      img.onload = () => {
        c.fillStyle = '#ffffff';
        c.fillRect(0, 0, canvas.width, canvas.height);
        c.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = initialDataUrl;
    }
  }, [initialDataUrl, isOpen]);

  useEffect(() => {
    if (!ctx || !ref.current) return;
    const canvas = ref.current;

    const start = (e) => {
      drawing.current = true;
      const pos = getPos(e);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    };
    const move = (e) => {
      if (!drawing.current) return;
      const pos = getPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    };
    const end = () => {
      drawing.current = false;
      if (signatureKey && ref.current && onSignatureChangeRef.current) {
        const dataUrl = ref.current.toDataURL('image/png');
        if (dataUrl && dataUrl.length > 50) onSignatureChangeRef.current(signatureKey, dataUrl);
      }
    };

    function getPos(e) {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const scaleX = canvas.width / (rect.width || 1);
      const scaleY = canvas.height / (rect.height || 1);
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    }

    const prevent = (e) => e.preventDefault();
    canvas.addEventListener('mousedown', prevent);
    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseup', end);
    canvas.addEventListener('mouseleave', end);
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); start(e); });
    canvas.addEventListener('touchmove', (e) => { e.preventDefault(); move(e); });
    canvas.addEventListener('touchend', (e) => { e.preventDefault(); end(); });
    return () => {
      canvas.removeEventListener('mousedown', prevent);
      canvas.removeEventListener('mousedown', start);
      canvas.removeEventListener('mousemove', move);
      canvas.removeEventListener('mouseup', end);
      canvas.removeEventListener('mouseleave', end);
      canvas.removeEventListener('touchstart', start);
      canvas.removeEventListener('touchmove', move);
      canvas.removeEventListener('touchend', end);
    };
  }, [ctx, signatureKey]);

  const clear = () => {
    const canvas = ref.current;
    if (canvas) {
      const c = canvas.getContext('2d');
      c.fillStyle = '#ffffff';
      c.fillRect(0, 0, canvas.width, canvas.height);
    }
  };
  const getDataUrl = () => ref.current?.toDataURL?.('image/png') || '';

  return [ref, clear, getDataUrl];
}

function SigPad({ label, refOrHook }) {
  const [ref, clear] = refOrHook;
  return (
    <div className="officials-sig-block">
      <label className="officials-sig-label">{label}</label>
      <div className="officials-sig-canvas-wrap">
        <canvas
          ref={ref}
          width={280}
          height={60}
          className="officials-sig-canvas"
          style={{
            touchAction: 'none',
            display: 'block',
            width: '100%',
            maxWidth: '280px',
            height: '60px',
            backgroundColor: '#ffffff',
            border: '2px solid #333',
            borderRadius: '4px',
            cursor: 'crosshair'
          }}
          tabIndex={0}
          title="Sign here (black ink on white)"
        />
      </div>
      <button type="button" className="officials-sig-clear" onClick={clear}>Clear</button>
    </div>
  );
}

const SIG_KEYS = ['captainSignA1', 'captainSignA2', 'coachSignA', 'captainSignB1', 'captainSignB2', 'coachSignB', 'firstRefSign', 'secondRefSign', 'scorerSign', 'assistScorerSign'];

export default function OfficialsModal({ open, gameData, onSave, onClose }) {
  const officials = gameData?.officials || {};
  const [teamAName, setTeamAName] = useState(gameData?.teamAName || '');
  const [teamBName, setTeamBName] = useState(gameData?.teamBName || '');
  const [coachA, setCoachA] = useState(officials.coachA || '');
  const [asstCoachA, setAsstCoachA] = useState(officials.asstCoachA || '');
  const [medicalA, setMedicalA] = useState(officials.medicalA || '');
  const [trainerA, setTrainerA] = useState(officials.trainerA || '');
  const [coachB, setCoachB] = useState(officials.coachB || '');
  const [asstCoachB, setAsstCoachB] = useState(officials.asstCoachB || '');
  const [medicalB, setMedicalB] = useState(officials.medicalB || '');
  const [trainerB, setTrainerB] = useState(officials.trainerB || '');

  const [signatureDataUrls, setSignatureDataUrls] = useState({
    captainSignA1: '', captainSignA2: '', coachSignA: '',
    captainSignB1: '', captainSignB2: '', coachSignB: '',
    firstRefSign: '', secondRefSign: '', scorerSign: '', assistScorerSign: ''
  });

  const handleSignatureChange = (key, dataUrl) => {
    setSignatureDataUrls(prev => ({ ...prev, [key]: dataUrl }));
  };

  const captainA1 = useSignatureCanvas(officials.signatures?.captainSignA1, 'captainSignA1', handleSignatureChange, open);
  const captainA2 = useSignatureCanvas(officials.signatures?.captainSignA2, 'captainSignA2', handleSignatureChange, open);
  const coachASig = useSignatureCanvas(officials.signatures?.coachSignA, 'coachSignA', handleSignatureChange, open);
  const captainB1 = useSignatureCanvas(officials.signatures?.captainSignB1, 'captainSignB1', handleSignatureChange, open);
  const captainB2 = useSignatureCanvas(officials.signatures?.captainSignB2, 'captainSignB2', handleSignatureChange, open);
  const coachBSig = useSignatureCanvas(officials.signatures?.coachSignB, 'coachSignB', handleSignatureChange, open);
  const firstRef = useSignatureCanvas(officials.signatures?.firstRefSign, 'firstRefSign', handleSignatureChange, open);
  const secondRef = useSignatureCanvas(officials.signatures?.secondRefSign, 'secondRefSign', handleSignatureChange, open);
  const scorerSig = useSignatureCanvas(officials.signatures?.scorerSign, 'scorerSign', handleSignatureChange, open);
  const assistScorerSig = useSignatureCanvas(officials.signatures?.assistScorerSign, 'assistScorerSign', handleSignatureChange, open);

  useEffect(() => {
    if (!open) return;
    setTeamAName(gameData?.teamAName || '');
    setTeamBName(gameData?.teamBName || '');
    setCoachA(gameData?.officials?.coachA || '');
    setAsstCoachA(gameData?.officials?.asstCoachA || '');
    setMedicalA(gameData?.officials?.medicalA || '');
    setTrainerA(gameData?.officials?.trainerA || '');
    setCoachB(gameData?.officials?.coachB || '');
    setAsstCoachB(gameData?.officials?.asstCoachB || '');
    setMedicalB(gameData?.officials?.medicalB || '');
    setTrainerB(gameData?.officials?.trainerB || '');
    const sigs = gameData?.officials?.signatures || {};
    setSignatureDataUrls({
      captainSignA1: sigs.captainSignA1 || '',
      captainSignA2: sigs.captainSignA2 || '',
      coachSignA: sigs.coachSignA || '',
      captainSignB1: sigs.captainSignB1 || '',
      captainSignB2: sigs.captainSignB2 || '',
      coachSignB: sigs.coachSignB || '',
      firstRefSign: sigs.firstRefSign || '',
      secondRefSign: sigs.secondRefSign || '',
      scorerSign: sigs.scorerSign || '',
      assistScorerSign: sigs.assistScorerSign || ''
    });
  }, [open, gameData]);

  const handleSave = () => {
    const getDataUrl = (hook) => (hook && hook[2] && typeof hook[2] === 'function' ? hook[2]() : '');
    const fromCanvas = {
      captainSignA1: getDataUrl(captainA1),
      captainSignA2: getDataUrl(captainA2),
      coachSignA: getDataUrl(coachASig),
      captainSignB1: getDataUrl(captainB1),
      captainSignB2: getDataUrl(captainB2),
      coachSignB: getDataUrl(coachBSig),
      firstRefSign: getDataUrl(firstRef),
      secondRefSign: getDataUrl(secondRef),
      scorerSign: getDataUrl(scorerSig),
      assistScorerSign: getDataUrl(assistScorerSig)
    };
    const signatures = { ...signatureDataUrls };
    SIG_KEYS.forEach(k => {
      const url = fromCanvas[k] || signatureDataUrls[k];
      if (url && url.length > 50) signatures[k] = url;
    });
    onSave({
      teamAName: teamAName.trim() || gameData?.teamAName,
      teamBName: teamBName.trim() || gameData?.teamBName,
      coachA, asstCoachA, medicalA, trainerA,
      coachB, asstCoachB, medicalB, trainerB,
      signatures
    });
    onClose();
  };

  if (!open) return null;

  return (
    <div className="officials-modal-overlay" onClick={onClose}>
      <div className="officials-modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 className="officials-modal-title">Team officials & signatures</h3>
        <p className="officials-modal-desc">Team staff and captain/coach signatures</p>

        <div className="officials-team-block team-a-block">
          <h4>Team A: {teamAName || 'Team A'}</h4>
          <input type="text" placeholder="Team A name" value={teamAName} onChange={(e) => setTeamAName(e.target.value)} className="officials-input" />
          <div className="officials-fields">
            <input type="text" placeholder="Coach" value={coachA} onChange={(e) => setCoachA(e.target.value)} />
            <input type="text" placeholder="Assistant coach" value={asstCoachA} onChange={(e) => setAsstCoachA(e.target.value)} />
            <input type="text" placeholder="Medical officer" value={medicalA} onChange={(e) => setMedicalA(e.target.value)} />
            <input type="text" placeholder="Trainer" value={trainerA} onChange={(e) => setTrainerA(e.target.value)} />
          </div>
          <div className="officials-signatures-row">
            <SigPad label="Captain (before)" refOrHook={captainA1} />
            <SigPad label="Captain (after)" refOrHook={captainA2} />
            <SigPad label="Coach signature" refOrHook={coachASig} />
          </div>
        </div>

        <div className="officials-team-block team-b-block">
          <h4>Team B: {teamBName || 'Team B'}</h4>
          <input type="text" placeholder="Team B name" value={teamBName} onChange={(e) => setTeamBName(e.target.value)} className="officials-input" />
          <div className="officials-fields">
            <input type="text" placeholder="Coach" value={coachB} onChange={(e) => setCoachB(e.target.value)} />
            <input type="text" placeholder="Assistant coach" value={asstCoachB} onChange={(e) => setAsstCoachB(e.target.value)} />
            <input type="text" placeholder="Medical officer" value={medicalB} onChange={(e) => setMedicalB(e.target.value)} />
            <input type="text" placeholder="Trainer" value={trainerB} onChange={(e) => setTrainerB(e.target.value)} />
          </div>
          <div className="officials-signatures-row">
            <SigPad label="Captain (before)" refOrHook={captainB1} />
            <SigPad label="Captain (after)" refOrHook={captainB2} />
            <SigPad label="Coach signature" refOrHook={coachBSig} />
          </div>
        </div>

        <div className="officials-refs-block">
          <h4>Match officials signatures</h4>
          <div className="officials-ref-sigs">
            <SigPad label="1st Referee" refOrHook={firstRef} />
            <SigPad label="2nd Referee" refOrHook={secondRef} />
            <SigPad label="Scorer" refOrHook={scorerSig} />
            <SigPad label="Asst. Scorer" refOrHook={assistScorerSig} />
          </div>
        </div>

        <div className="officials-modal-buttons">
          <button type="button" className="officials-btn cancel" onClick={onClose}>Close</button>
          <button type="button" className="officials-btn save" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}
