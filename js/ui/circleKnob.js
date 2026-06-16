function createCircleKnob(cid, {
    label,
    value,
    unit = '',
    min,
    max,
    step = 0.01,
    dragSpeed = 0.3,
    width = 120,
    height = 120,
    tickCount = 50,
    majorTickEvery = 10,
    arcColor = '#1aa3ff',
    bgColor = '#003366',
    trackColor = '#1a1a4a',
    pointerColor = '#ff3300',
    tickColor = '#565',
    onChange
    }) {
        
    const div = document.createElement('div');
    div.className = 'knob-container';

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.id = 'unison_knob';

    div.appendChild(canvas);

    const knob = new ClassicKnob(cid, {
      title: label,
      min: min,
      max: max,
      value: value,
      unit: unit,
      dragSpeed: dragSpeed,
      tickCount: tickCount,
      majorTickEvery: majorTickEvery,
      arcColor: '#1aa3ff',
      bgColor: '#003366',
      trackColor: '#1a1a4a',
      pointerColor: '#ff3300',
      tickColor: '#565',

      onChange: (val) => {
        config.value = val;
        if (onChange) onChange(val);
      }
    });
    div.knob = knob;
    return div;
  
}