function createRNSlider({
    label,
    value,
    min,
    max,
    step = 0.01,
    orientation = 'horizontal',
    width = 260,
    height = 60,
    onChange,
    onCommit 
}) {
    const wrapper = document.createElement('div');
    wrapper.className = 'rn-slider-wrapper';

    const canvas = document.createElement('canvas');
    if(orientation != 'circle'){
        canvas.className = 'slider-canvas';
    }else{
        canvas.className = 'circle-canvas';
    }
    
    wrapper.appendChild(canvas);

    let startValue = value;
    let dragging = false;

    const slider = new RNSlider(canvas, {
        label,
        min,
        max,
        value,
        step,
        orientation,
        width,
        height,
        onChange: v => {
            if (!dragging) {
                startValue = slider.getValue();
                dragging = true;
            }
            onChange?.(v);
        }
    });

    const commit = () => {
        if (!dragging) return;
        dragging = false;

        const endValue = slider.getValue();
        if (onCommit && startValue !== endValue) {
            onCommit(startValue, endValue);
        }
    };

    canvas.addEventListener('pointerup', commit);
    canvas.addEventListener('pointerleave', commit);
    window.addEventListener('pointerup', commit);
    wrapper.setValue = (v) => slider.setValue(v);
    wrapper.getValue = () => slider.getValue();
    wrapper.slider = slider;

    return wrapper;
}

