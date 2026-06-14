function makeBtn(label) {
  const btn = document.createElement('button');
  btn.textContent = label;
  Object.assign(btn.style, {
    position:      'fixed',
    bottom:        '9%',
    left:          '50%',
    transform:     'translateX(-50%)',
    padding:       '16px 60px',
    fontSize:      '20px',
    fontFamily:    'Arial, Helvetica, sans-serif',
    fontWeight:    '700',
    letterSpacing: '6px',
    color:         '#ffaa33',
    background:    'rgba(0,0,0,0.55)',
    border:        '2px solid #ffaa33',
    borderRadius:  '4px',
    cursor:        'pointer',
    zIndex:        '100',
    transition:    'opacity 0.55s, background 0.2s',
  });
  btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(255,170,51,0.18)'; });
  btn.addEventListener('mouseleave', () => { btn.style.background = 'rgba(0,0,0,0.55)'; });
  document.body.appendChild(btn);
  return btn;
}

function showBtn(btn, other) {
  other.style.opacity       = '0';
  other.style.pointerEvents = 'none';
  btn.style.opacity         = '1';
  btn.style.pointerEvents   = 'auto';
}

export function createUI({ onRide, onStop }) {
  const rideBtn = makeBtn('RIDE');
  const stopBtn = makeBtn('STOP');
  stopBtn.style.opacity       = '0';
  stopBtn.style.pointerEvents = 'none';

  rideBtn.addEventListener('click', () => { showBtn(stopBtn, rideBtn); onRide(); });
  stopBtn.addEventListener('click', () => { showBtn(rideBtn, stopBtn); onStop(); });
}
