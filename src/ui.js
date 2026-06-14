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

export function createLoadingScreen() {
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position:       'fixed',
    inset:          '0',
    background:     'rgba(0,0,0,0.88)',
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    zIndex:         '300',
    transition:     'opacity 0.6s',
  });

  const label = document.createElement('div');
  Object.assign(label.style, {
    color:         '#ffaa33',
    fontFamily:    'Arial, Helvetica, sans-serif',
    fontSize:      '13px',
    letterSpacing: '5px',
    marginBottom:  '20px',
  });
  label.textContent = 'LOADING';

  const track = document.createElement('div');
  Object.assign(track.style, {
    width:        '200px',
    height:       '2px',
    background:   'rgba(255,170,51,0.2)',
    borderRadius: '1px',
    overflow:     'hidden',
  });

  const fill = document.createElement('div');
  Object.assign(fill.style, {
    height:     '100%',
    width:      '0%',
    background: '#ffaa33',
    transition: 'width 0.25s ease',
  });

  track.appendChild(fill);
  overlay.appendChild(label);
  overlay.appendChild(track);
  document.body.appendChild(overlay);

  return {
    setProgress(pct) { fill.style.width = `${pct}%`; },
    hide() {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 650);
    },
  };
}

function createFullscreenBtn() {
  const btn = document.createElement('button');
  btn.title = 'Toggle fullscreen';
  btn.textContent = '⛶';
  Object.assign(btn.style, {
    position:   'fixed',
    top:        '16px',
    right:      '16px',
    width:      '36px',
    height:     '36px',
    padding:    '0',
    fontSize:   '18px',
    lineHeight: '1',
    color:      '#ffaa33',
    background: 'rgba(0,0,0,0.45)',
    border:     '1px solid rgba(255,170,51,0.45)',
    borderRadius: '4px',
    cursor:     'pointer',
    zIndex:     '100',
    transition: 'background 0.2s',
  });
  btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(255,170,51,0.18)'; });
  btn.addEventListener('mouseleave', () => { btn.style.background = 'rgba(0,0,0,0.45)'; });
  btn.addEventListener('click', () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  });
  document.body.appendChild(btn);
}

export function createUI({ onRide, onStop }) {
  createFullscreenBtn();

  const rideBtn = makeBtn('RIDE');
  const stopBtn = makeBtn('STOP');
  stopBtn.style.opacity       = '0';
  stopBtn.style.pointerEvents = 'none';

  rideBtn.addEventListener('click', () => { showBtn(stopBtn, rideBtn); onRide(); });
  stopBtn.addEventListener('click', () => { showBtn(rideBtn, stopBtn); onStop(); });
}
