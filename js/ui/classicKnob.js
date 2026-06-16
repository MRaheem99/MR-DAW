class ClassicKnob {
  constructor(canvasId, config = {}) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) throw new Error(`Canvas "${canvasId}" not found`);

    this.ctx = this.canvas.getContext('2d');

    // Config with defaults
    this.title = config.title ?? 'Control';
    this.min = config.min ?? 0;
    this.max = config.max ?? 100;
    this.value = config.value ?? 0;
    this.step = config.step ?? 0.1;
    this.unit = config.unit ?? '';
    this.dragSpeed = config.dragSpeed ?? 1;
    this.arcColor = config.arcColor ?? '#994d00';
    this.bgColor = config.bgColor ?? '#003366';
    this.trackColor = config.trackColor ?? '#1a1a4a';
    this.pointerColor = config.pointerColor ?? '#ff3300';
    this.tickColor = config.tickColor ?? '#eee';
    this.tickCount = config.tickCount ?? 50;
    this.majorTickEvery = config.majorTickEvery ?? 10;

    // 🔥 NEW: onChange callback
    this.onChange = typeof config.onChange === 'function' ? config.onChange : null;

    // Geometry
    this.cx = this.canvas.width / 2;
    this.cy = this.canvas.height / 2;
    this.radius = Math.min(this.canvas.width, this.canvas.height) / 2 - 30;

    this.startAngle = Math.PI * 0.75; // 135° (bottom-left)

    this.isDragging = false;
    this.prevAngle = 0;

    this.initEvents();
    this.draw();
  }

  initEvents() {
    const start = (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.clientX || (e.touches?.[0]?.clientX);
      const clientY = e.clientY || (e.touches?.[0]?.clientY);
      if (clientX == null || clientY == null) return;

      const x = clientX - rect.left - this.cx;
      const y = clientY - rect.top - this.cy;
      const dist = Math.hypot(x, y);

      // Only respond to clicks/touches in the outer ring
      if (dist < this.radius - 20 || dist > this.radius + 20) return;

      this.isDragging = true;
      this.prevAngle = Math.atan2(y, x);
      this.canvas.style.cursor = 'grabbing';
    };

    const move = (e) => {
      if (!this.isDragging) return;
      e.preventDefault();

      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.clientX || (e.touches?.[0]?.clientX);
      const clientY = e.clientY || (e.touches?.[0]?.clientY);
      if (clientX == null || clientY == null) return;

      const x = clientX - rect.left - this.cx;
      const y = clientY - rect.top - this.cy;
      let angle = Math.atan2(y, x);

      let delta = angle - this.prevAngle;
      if (delta > Math.PI) delta -= 2 * Math.PI;
      if (delta < -Math.PI) delta += 2 * Math.PI;

      const change = delta * this.dragSpeed * (this.max - this.min) / (Math.PI * 1.5);
      let newValue = this.value + change;
      newValue = Math.max(this.min, Math.min(this.max, newValue));
      newValue = Math.round(newValue / this.step) * this.step; // snap to step

      // 🔥 Only update if value actually changed
      if (newValue !== this.value) {
        this.value = newValue;
        this.draw();

        // 🔥 TRIGGER onChange CALLBACK
        if (this.onChange) {
          this.onChange(this.value, this); // pass value and knob instance
        }
      }

      this.prevAngle = angle;
    };

    const end = () => {
      this.isDragging = false;
      this.canvas.style.cursor = 'grab';
    };

    // Use modern pointer events with touch fallback
    this.canvas.addEventListener('pointerdown', start);
    this.canvas.addEventListener('pointermove', move);
    this.canvas.addEventListener('pointerup', end);
    this.canvas.addEventListener('pointerleave', end);

    // Touch fallback for older browsers
    this.canvas.addEventListener('touchstart', start, { passive: false });
    this.canvas.addEventListener('touchmove', move, { passive: false });
    this.canvas.addEventListener('touchend', end);
    this.canvas.addEventListener('touchcancel', end);
  }

  // Optional: public method to set value programmatically
  setValue(newValue) {
    this.value = Math.max(this.min, Math.min(this.max, newValue));
    this.value = Math.round(this.value / this.step) * this.step;
    this.draw();
    if (this.onChange) {
      this.onChange(this.value, this);
    }
  }

  draw() {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = '#367';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#eee';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, width, height);

    // Outer circle
    ctx.fillStyle = this.bgColor;
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, this.radius + 10, 0, Math.PI * 2);
    ctx.fill();

    // Track arc (full range)
    ctx.strokeStyle = this.trackColor;
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, this.radius, this.startAngle, this.startAngle + Math.PI * 1.5);
    ctx.stroke();

    // Value arc
    const progress = (this.value - this.min) / (this.max - this.min);
    const endAngle = this.startAngle + progress * Math.PI * 1.5;
    ctx.strokeStyle = this.arcColor;
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, this.radius, this.startAngle, endAngle);
    ctx.stroke();

    // Ticks
    ctx.strokeStyle = this.tickColor;
    ctx.fillStyle = this.tickColor;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= this.tickCount; i++) {
      const angle = this.startAngle + (i / this.tickCount) * Math.PI * 1.5;
      const isMajor = i % this.majorTickEvery === 0;
      const len = isMajor ? 8 : 4;
      const inner = this.radius - len;
      const outer = this.radius + 4;

      ctx.beginPath();
      ctx.moveTo(
        this.cx + Math.cos(angle) * inner,
        this.cy + Math.sin(angle) * inner
      );
      ctx.lineTo(
        this.cx + Math.cos(angle) * outer,
        this.cy + Math.sin(angle) * outer
      );
      ctx.lineWidth = isMajor ? 2 : 1;
      ctx.stroke();

      // Label min/max
      if (i === 0) {
        const labelValue = Math.round(this.min);
        const labelRadius = this.radius + 16;
        const labelX = this.cx + Math.cos(angle) * labelRadius;
        const labelY = this.cy + Math.sin(angle) * labelRadius;
        ctx.textAlign = 'right';
        ctx.fillStyle = '#eee';
        ctx.fillText(labelValue.toString(), labelX, labelY);
      }
      if (i === this.tickCount) {
        const labelValue = Math.round(this.max);
        const labelRadius = this.radius + 16;
        const labelX = this.cx + Math.cos(angle) * labelRadius;
        const labelY = this.cy + Math.sin(angle) * labelRadius;
        ctx.textAlign = 'left';
        ctx.fillStyle = '#eee';
        ctx.fillText(labelValue.toString(), labelX, labelY);
      }
    }

    // Center cap
    ctx.fillStyle = '#152437';
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, 30, 0, Math.PI * 2);
    ctx.fill();

    // Pointer
    ctx.strokeStyle = this.pointerColor;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(this.cx, this.cy);
    ctx.lineTo(
      this.cx + Math.cos(endAngle) * (this.radius),
      this.cy + Math.sin(endAngle) * (this.radius)
    );
    ctx.stroke();

    ctx.fillStyle = '#004d80';
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, 20, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#002d50';
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, 15, 0, Math.PI * 2);
    ctx.fill();

    // Value text
    ctx.fillStyle = '#eee';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Fix: don't use canvas height in offset — use fixed position
    ctx.fillText(
      this.value.toFixed(this.step < 1 ? 2 : 0) + this.unit,
      this.cx,
      this.cy - 50
    );

    // Title
    ctx.fillStyle = '#eee';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(this.title, this.cx, this.cy + this.radius + 20);
  }
}