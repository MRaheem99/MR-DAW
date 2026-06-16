//popups.js
let allpopups = {};
function openPopup({ id = null, title, content, width = 'auto', height = 'auto', addClass = null, remex = null, onClose = () => {} }) {
    const popupId = id; // || `popup-${title.toLowerCase().replace(/\s+/g, '-')}`;
    
    let existingPopup = document.getElementById(popupId);
    if (existingPopup) {
        existingPopup.focus();
        document.querySelectorAll('.popup').forEach(el => {
            if(el.id != 'bpm-popup'){
                el.style.zIndex = '100'; 
            }
        });
        existingPopup.style.zIndex = '1000';
        return existingPopup;
    }
  
    if (remex) {
        document.querySelectorAll('.' + remex).forEach(el => el.remove());
    }
    
    document.querySelectorAll('.popup').forEach(el => {
        if(el.id != popupId){
            el.style.zIndex = '100'; 
        }
    });

    const popup = document.createElement('div');
    popup.id = popupId;

    const panel = document.createElement('div');
    panel.className = 'popup-panel';
    panel.style.width = width;
    panel.style.height = height;
    panel.tabIndex = -1;

    const header = document.createElement('div');
    header.id = 'popup-header_'+popupId;
    header.className = 'popup-header';

    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    overlay.onclick = () => {
        popup.remove();
        onClose();
    };

    const titleEl = document.createElement('span');
    titleEl.textContent = title;
    titleEl.id = 'popupTitlespan_'+popupId;

    const closeBtn = document.createElement('span');
    closeBtn.className = 'popup-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = () => {
        popup.remove();
        onClose();
    };

    header.append(titleEl, closeBtn);

    const body = document.createElement('div');
    body.className = 'popup-body';
    body.appendChild(content);

    panel.append(header, body);
    popup.append(overlay, panel);
    document.body.appendChild(popup);
    
    document.querySelector('#popup-header_'+popupId).onclick = () => {
        document.querySelectorAll('.popup').forEach(el => el.style.zIndex = '100');
        popup.style.zIndex = '1000';
    };
    
    if(addClass){
        popup.className = 'popup '+addClass;
    } else {
        popup.className = 'popup';
    }
    popup.style.zIndex = '1000';

    makeDraggable(panel, header, popup);

    panel.focus();

    return popup;
}

function createSmallInput(label, val) {
    const div = document.createElement('div');
    div.style.flex = "1";
    
    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    labelEl.style.display = 'block';
    labelEl.style.fontSize = '10px';
    labelEl.style.color = '#888';
    labelEl.style.marginBottom = '2px';

    const input = document.createElement('input');
    input.type = 'number';
    input.value = val;
    input.style.width = '100%';
    input.style.background = '#222';
    input.style.color = '#fff';
    input.style.border = '1px solid #444';
    input.style.padding = '4px';
    input.style.borderRadius = '3px';
    input.style.fontSize = '12px';

    div.appendChild(labelEl);
    div.appendChild(input);
    
    return { div, input };
}

function makeDraggable(panel, handle, popup) {
    
    //popup.onclick = () => {
    //    const popups = document.querySelectorAll('.popup');
    //    popups.forEach(el => {
    //        el.style.zIndex = '100'; 
    //    });
    //    popup.style.zIndex = '1000';
    //}
    //popup.style.zIndex = '1000';
    
    let offsetX = 0, offsetY = 0;

    const onStart = (e) => {
        
        if (e.target.closest('button') || e.target.closest('input') || e.target.classList.contains('popup-close')) return;

        const pageX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
        const pageY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;

        const rect = panel.getBoundingClientRect();
        offsetX = pageX - rect.left;
        offsetY = pageY - rect.top;

        panel.style.position = 'fixed';
        panel.style.margin = '0';
        panel.style.transform = 'none'; 
        panel.style.left = rect.left + 'px';
        panel.style.top = rect.top + 'px';

        if (e.type === 'touchstart') {
            document.addEventListener('touchmove', onMove, { passive: false });
            document.addEventListener('touchend', onEnd);
        } else {
            document.onmousemove = onMove;
            document.onmouseup = onEnd;
        }
        
        if (e.type === 'touchstart') e.preventDefault();
    };

    const onMove = (e) => {
        const pageX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
        const pageY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;

        let x = pageX - offsetX;
        let y = pageY - offsetY;

        const rect = panel.getBoundingClientRect();
        x = Math.max(0, Math.min(x, window.innerWidth - rect.width));
        y = Math.max(0, Math.min(y, window.innerHeight - rect.height));

        panel.style.left = x + 'px';
        panel.style.top = y + 'px';

        if (e.type === 'touchmove') e.preventDefault();
    };

    const onEnd = () => {
        document.onmousemove = null;
        document.onmouseup = null;
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onEnd);
    };

    handle.addEventListener('mousedown', onStart);
    handle.addEventListener('touchstart', onStart, { passive: false });
}

function createTextField(label, value, onChange) {
    const wrapper = document.createElement('div');
    wrapper.className = 'popup-field';

    const span = document.createElement('span');
    span.textContent = label;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = value;
    input.maxLength = 20;
    input.addEventListener('input', () => onChange(input.value));

    wrapper.append(span, input);
    return wrapper;
}

function createStepper(label, value, min, max, step, onChange) {
    
    if (typeof value !== 'number') {
        value = min ?? 0;
    }
    
    const wrapper = document.createElement('div');
    wrapper.className = 'popup-field';

    const span = document.createElement('span');
    span.textContent = label;

    const minus = document.createElement('button');
    minus.textContent = '-';

    const plus = document.createElement('button');
    plus.textContent = '+';

    const valSpan = document.createElement('div');
    valSpan.textContent = value.toFixed(2);
    valSpan.className = 'popup-value';

    minus.addEventListener('click', () => {
        value = Math.max(min, value - step);
        valSpan.textContent = value.toFixed(2);
        onChange(value);
    });

    plus.addEventListener('click', () => {
        value = Math.min(max, value + step);
        valSpan.textContent = value.toFixed(2);
        onChange(value);
    });

    wrapper.append(span, minus, valSpan, plus);
    return wrapper;
}

function createSelect(label, options, value, onChange) {
    const wrapper = document.createElement('div');
    wrapper.className = 'popup-control';
    
    const row1 = document.createElement('div');
    row1.className = 'popup-row';

    const title = document.createElement('div');
    title.className = 'popup-label';
    title.textContent = label;

    const select = document.createElement('select');

    options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        if (opt === value) option.selected = true;
        select.appendChild(option);
    });

    select.onchange = () => {
        onChange(select.value);
    };

    row1.append(title, select);
    wrapper.appendChild(row1);

    return wrapper;
}
