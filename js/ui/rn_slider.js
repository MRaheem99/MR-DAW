(function (global) {
    class RNSlider {
        constructor(canvasSelector, options = {}) {
      
            this.canvas = typeof canvasSelector === 'string'
            ? document.querySelector(canvasSelector)
            : canvasSelector;
            if (!this.canvas) throw new Error(`Canvas not found: ${canvasSelector}`);

            this.options = {
                label: options.label || 'Value',
                min: options.min ?? 0,
                max: options.max ?? 100,
                value: options.value ?? ((options.min ?? 0) + (options.max ?? 100)) / 2,
                step: options.step ?? 0.1,
                orientation: options.orientation || 'vertical',
                width: options.width ?? 80,
                height: options.height ?? 300,
                theme: {
                    bg: options.theme?.bg || ['#0d0d0d', '#161616'],
                    rail: options.theme?.rail || ['#4f5c63', '#394147'],
                    handle: options.theme?.handle || ['#555555', '#8c8c8c'],
                    accent: options.theme?.accent || '#cccccc',
                    text: options.theme?.text || '#666666',
                },
                fontSize: options.fontSize ?? 10,
                handleSize: {
                    width: options.handleSize?.width ?? (options.orientation === 'horizontal' ? 24 : 40),
                    height: options.handleSize?.height ?? (options.orientation === 'horizontal' ? 40 : 24),
                },
                railThickness: options.railThickness ?? 6,
                markerCount: options.markerCount ?? 20,
                onChange: options.onChange || (() => {}),
            };

            this.canvas.className = 'slider-canvas';
            this.ctx = this.canvas.getContext('2d');
            this.resize();
            this.isDragging = false;
            this.dragOffsetX = 0;
            this.dragOffsetY = 0;
    
            this.render();
            this.addEventListeners();
        }
    
        resize() {
            const dpr = window.devicePixelRatio || 1;
    
            let width  = this.options.width;
            let height = this.options.height;
    
            if (isMobile) {
                if (this.options.orientation === 'vertical') {
                    width  = Math.max(width, 45);
                    height = Math.max(height, 280);
                } else {
                    width  = Math.max(width, 280);
                    height = Math.max(height, 45);
                }
            }
    
            this.canvas.style.width  = width + 'px';
            this.canvas.style.height = height + 'px';
            this.canvas.className = 'slider-canvas';
            this.canvas.width  = width * dpr;
            this.canvas.height = height * dpr;
            this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            this.width  = width;
            this.height = height;
            this.render();
        }

        render() {
            const { ctx, width, height } = this;
            const {
                label,
                min,
                max,
                value,
                theme,
                fontSize,
                handleSize,
                railThickness,
                markerCount,
                orientation,
            } = this.options;

            ctx.clearRect(0, 0, width, height);

            const bgGradient = ctx.createLinearGradient(0, 0, width, height);
            bgGradient.addColorStop(0, theme.bg[0]);
            bgGradient.addColorStop(1, theme.bg[1]);
            ctx.fillStyle = bgGradient;
            ctx.beginPath();
            ctx.roundRect(0, 0, width, height, 6);
            ctx.fill();

            if (orientation === 'vertical') {
                const railX = width / 2 - railThickness / 2;
                const railY = fontSize * 2;
                const railHeight = height - railY - fontSize * 3;
                const railGradient = ctx.createLinearGradient(railX, railY, railX, railY + railHeight);
                railGradient.addColorStop(0, theme.rail[0]);
                railGradient.addColorStop(1, theme.rail[1]);
                ctx.fillStyle = railGradient;
                ctx.fillRect(railX, railY, railThickness, railHeight);
                ctx.strokeStyle = theme.text;
                ctx.lineWidth = 1;
                const markerSpacing = railHeight / (markerCount - 1);
                for (let i = 0; i < markerCount; i++) {
                    const y = railY + i * markerSpacing;
                    const isMajor = i % 4 === 0;
                    
                    ctx.lineWidth = isMajor ? 2 : 1;
                    const len = isMajor ? 10 : 6;
  
                    ctx.beginPath();
                    ctx.moveTo(railX - len, y);
                    ctx.lineTo(railX, y);
                    ctx.stroke();
                    
                    ctx.beginPath();
                    ctx.moveTo(railX + railThickness, y);
                    //ctx.lineTo(railX, y);
                    ctx.lineTo(railX + railThickness + len, y);
                    ctx.stroke();
                }

                const normalized = (value - min) / (max - min);
                const handleY = railY + railHeight * (1 - normalized) - handleSize.height / 2;
                const handleX = railX - (handleSize.width - railThickness) / 2;
                const handleGradient = ctx.createLinearGradient(handleX, handleY, handleX, handleY + handleSize.height);
                handleGradient.addColorStop(0, theme.handle[0]);
                handleGradient.addColorStop(1, theme.handle[1]);
                ctx.fillStyle = handleGradient;
                ctx.beginPath();
                ctx.roundRect(handleX, handleY, handleSize.width, handleSize.height, 6);
                ctx.fill();
                const gloss = ctx.createLinearGradient(handleX, handleY, handleX, handleY + handleSize.height);
                gloss.addColorStop(0, 'rgba(255,255,255,0.3)');
                gloss.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = gloss;
                ctx.beginPath();
                ctx.roundRect(handleX + 2, handleY + 2, handleSize.width - 4, handleSize.height - 4, 4);
                ctx.fill();
                ctx.font = `${fontSize * 1.2}px Inter, 'Segoe UI', sans-serif`;
                ctx.fillStyle = theme.accent;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(value.toFixed(this.getPrecision()), handleX + handleSize.width / 2, handleY + handleSize.height / 2);
                ctx.font = `${fontSize}px Inter, 'Segoe UI', sans-serif`;
                ctx.fillStyle = theme.text;
                ctx.textAlign = 'center';
                ctx.fillText(label, width / 2, height - fontSize * 2);
                ctx.fillText(value.toFixed(this.getPrecision()), width / 2, height - fontSize);
            } else if (orientation === 'horizontal') {
                const controlWidth = width * 0.85;
                const railY = height / 2 - railThickness / 2;
                const railX = (fontSize * 10);
                const railWidth = controlWidth - fontSize * 6;
                const railGradient = ctx.createLinearGradient(railX, railY, railX + railWidth, railY);
                railGradient.addColorStop(0, theme.rail[0]);
                railGradient.addColorStop(1, theme.rail[1]);
                ctx.fillStyle = railGradient;
                ctx.fillRect(railX, railY, railWidth, railThickness);
                ctx.strokeStyle = theme.text;
                ctx.lineWidth = 1;
                const markerSpacing = railWidth / (markerCount - 1);
                for (let i = 0; i < markerCount; i++) {
                    const x = railX + i * markerSpacing;
                    const isMajor = i % 4 === 0;
                    
                    ctx.lineWidth = isMajor ? 2 : 1;
                    const len = isMajor ? 10 : 6;
  
                    ctx.beginPath();
                    ctx.moveTo(x, railY - len);
                    ctx.lineTo(x, railY);
                    ctx.stroke();
                    
                    ctx.beginPath();
                    ctx.moveTo(x, railY + railThickness);
                    ctx.lineTo(x, railY + railThickness + len);
                    ctx.stroke();
                }

                const normalized = (value - min) / (max - min);
                const handleX = railX + railWidth * normalized - handleSize.width / 2;
                const handleY = railY - (handleSize.height / 2);
        
                ctx.shadowColor = 'rgba(0,0,0,0.2)';
                ctx.shadowBlur = 6;
                const handleGradient = ctx.createLinearGradient(handleX, handleY, handleX, handleY + handleSize.height);
                handleGradient.addColorStop(0, theme.handle[0]);
                handleGradient.addColorStop(1, theme.handle[1]);
                ctx.fillStyle = handleGradient;
                ctx.beginPath();
                ctx.roundRect(handleX, handleY, handleSize.width, handleSize.height, 6);
                ctx.fill();
                ctx.shadowBlur = 0;
        
                const gloss = ctx.createLinearGradient(handleX, handleY, handleX, handleY + handleSize.height);
                gloss.addColorStop(0, 'rgba(255,255,255,0.4)');
                gloss.addColorStop(1, 'rgba(0,0,0,0.05)');
                ctx.fillStyle = gloss;
                ctx.beginPath();
                ctx.roundRect(handleX + 2, handleY + 2, handleSize.width - 4, handleSize.height - 4, 4);
                ctx.fill();
                ctx.font = `${fontSize * 1.2}px Inter, 'Segoe UI', sans-serif`;
                ctx.fillStyle = theme.accent;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(value.toFixed(this.getPrecision()), handleX + handleSize.width / 2, handleY + handleSize.height / 2);
                ctx.font = `${fontSize}px Inter, 'Segoe UI', sans-serif`;
                ctx.fillStyle = theme.text;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(label, 8, height / 2 - fontSize * 0.8);
                ctx.fillText(value.toFixed(this.getPrecision()), 8, height / 2 + fontSize * 0.2);
            }
        }

        addEventListeners() {
            const canvas = this.canvas;
            const getPos = (e) => {
                const rect = canvas.getBoundingClientRect();
                const p = e.touches ? e.touches[0] : e;
                return {
                    x: p.clientX - rect.left,
                    y: p.clientY - rect.top
                };
            };

            const startDrag = (e) => {
                const { x, y } = getPos(e);
                if (!this.isHandleClicked(x, y)) return;
                this.canvas.style.cursor = 'pointer';
            
                e.preventDefault();
                this.isDragging = true;

                if (this.options.orientation === 'vertical') {
                    this.dragOffsetY = y - this.getHandleCenterY();
                } else {
                    this.dragOffsetX = x - this.getHandleCenterX();
                }
            };

            const moveDrag = (e) => {
                if (!this.isDragging) return;
                e.preventDefault();
            
                const { x, y } = getPos(e);
            
                if (this.options.orientation === 'vertical') {
                    this.updateValueFromY(y - this.dragOffsetY);
                } else {
                    this.updateValueFromX(x - this.dragOffsetX);
                }
            };

            const endDrag = () => {
                this.isDragging = false;
                this.canvas.style.cursor = 'default';
            };

            canvas.addEventListener('mousedown', startDrag);
            window.addEventListener('mousemove', moveDrag);
            window.addEventListener('mouseup', endDrag);
            canvas.addEventListener('touchstart', startDrag, { passive: false });
            window.addEventListener('touchmove', moveDrag, { passive: false });
            window.addEventListener('touchend', endDrag);
        }

        isHandleClicked(x, y) {
            const cx = this.getHandleCenterX();
            const cy = this.getHandleCenterY();
            const hitPadding = isMobile ? 18 : 10;
        
            return (
                Math.abs(x - cx) <= (this.options.handleSize.width / 2 + hitPadding) &&
                Math.abs(y - cy) <= (this.options.handleSize.height / 2 + hitPadding)
            );
        }

        getHandleCenterX() {
            const { orientation, min, max, value } = this.options;
        
            if (orientation === 'vertical') {
                return this.width / 2;
            }
        
            const railX = this.options.fontSize * 10;
            const railWidth = this.width * 0.85 - this.options.fontSize * 6;
            const normalized = (value - min) / (max - min);
            return railX + railWidth * normalized;
        }

        getHandleCenterY() {
            const { min, max, value } = this.options;
            const railY = this.options.fontSize * 2;
            const railHeight = this.height - railY - this.options.fontSize * 3;
            const normalized = (value - min) / (max - min);
            return railY + railHeight * (1 - normalized);
        }

        updateValueFromY(y) {
            const { min, max, step } = this.options;
            const railY = this.options.fontSize * 2;
            const railHeight = this.height - railY - this.options.fontSize * 3;
            const clamped = Math.max(railY, Math.min(railY + railHeight, y));
            const normalized = 1 - (clamped - railY) / railHeight;
            let value = min + normalized * (max - min);
            if (step) value = Math.round(value / step) * step;
    
            value = Math.max(min, Math.min(max, value));
            this.options.value = value;
            this.options.onChange(value);
            this.render();
        }
    
        updateValueFromX(x) { 
            const { min, max, step } = this.options;
            const railX = this.options.fontSize * 10;
            const railWidth = this.width * 0.85 - this.options.fontSize * 6;
            const clamped = Math.max(railX, Math.min(railX + railWidth, x));
            const normalized = (clamped - railX) / railWidth;
            let value = min + normalized * (max - min);
            if (step) value = Math.round(value / step) * step;
    
            value = Math.max(min, Math.min(max, value));
            this.options.value = value;
            this.options.onChange(value);
            this.render();
        }
    
        setValue(value) {
            this.options.value = Math.max(this.options.min, Math.min(this.options.max, value));
            this.render();
            this.options.onChange(this.options.value);
        }
    
        getValue() {
            return this.options.value;
        }
    
        destroy() {
          // Cleanup can be added if needed
        }
        getPrecision() {
            const step = this.options.step;
            if (!step || step >= 1) return 0;
            const s = step.toString();
            return s.includes('.') ? s.split('.')[1].length : 0;
        }
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = RNSlider;
    } else {
        global.RNSlider = RNSlider;
    }
})(typeof window !== 'undefined' ? window : global);