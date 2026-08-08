import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  /** Smallest increment. One dial detent, one arrow key, one ± tap. */
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  decimals?: number;
  /** Shown faintly when empty — usually yesterday's value. */
  placeholder?: number | null;
  /** Degrees of rotation per step. Lower = faster, higher = finer. */
  degreesPerStep?: number;
  autoFocus?: boolean;
}

const TAU = Math.PI * 2;

/**
 * Rotary dial with a typed value in the middle.
 *
 * Three ways in, because each is fastest for a different job:
 *   - **Drag the ring** for relative adjustment. It tracks *accumulated angle*,
 *     not absolute position, so grabbing the dial anywhere never jumps the value
 *     — you can spin it repeatedly, like a real jog wheel.
 *   - **Type in the centre** when you already know the number. Nothing beats
 *     four keystrokes for "84.2".
 *   - **Tap ± ** for a single exact step, which a drag cannot guarantee.
 *
 * Sub-step rotation is carried, not discarded, so a slow drag accumulates into a
 * change instead of feeling dead. Keyboard: arrows step, shift-arrow ×10.
 */
export function RotaryDial({
  label,
  value,
  onChange,
  step = 0.1,
  min,
  max,
  unit,
  decimals = 1,
  placeholder,
  degreesPerStep = 9,
  autoFocus,
}: Props) {
  const ringRef = useRef<HTMLDivElement>(null);
  const lastAngle = useRef<number | null>(null);
  /** Rotation not yet worth a whole step, kept so slow drags still register. */
  const carry = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [text, setText] = useState(value === null ? '' : value.toFixed(decimals));
  /** Set for exactly one update when the change came from the keyboard. */
  const typed = useRef(false);

  /**
   * Mirror the value into the readout, except for the one update that the user
   * typed — otherwise half-finished input like "8." would be rewritten as they
   * type. Every other source (drag, ±, arrows) must show immediately: a dial
   * whose number lags is a dial you are turning blind.
   */
  useEffect(() => {
    if (typed.current) {
      typed.current = false;
      return;
    }
    setText(value === null ? '' : value.toFixed(decimals));
  }, [value, decimals]);

  const clamp = useCallback(
    (n: number): number => {
      let out = n;
      if (min !== undefined) out = Math.max(min, out);
      if (max !== undefined) out = Math.min(max, out);
      // Snap to the step grid so the dial can never produce 84.30000000000001.
      return Number((Math.round(out / step) * step).toFixed(decimals));
    },
    [min, max, step, decimals],
  );

  /**
   * Latest committed value, read synchronously.
   *
   * Rapid input — a held arrow key, fast ± taps, a quick spin — fires several
   * times before React re-renders, and a closure over `value` would make every
   * one of them compute from the same stale number, silently dropping all but
   * the first.
   */
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const base = (): number => valueRef.current ?? placeholder ?? min ?? 0;

  /** Apply a change and record it immediately, so the next event sees it. */
  const apply = (next: number): void => {
    valueRef.current = next;
    onChange(next);
  };

  const bump = (steps: number): void => apply(clamp(base() + steps * step));

  const angleAt = (e: PointerEvent | React.PointerEvent): number | null => {
    const el = ringRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
  };

  const onPointerDown = (e: React.PointerEvent): void => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    lastAngle.current = angleAt(e);
    carry.current = 0;
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent): void => {
    if (!dragging || lastAngle.current === null) return;
    const now = angleAt(e);
    if (now === null) return;

    // Shortest signed arc, so crossing the 12 o'clock seam doesn't spike.
    let d = now - lastAngle.current;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    lastAngle.current = now;

    carry.current += (d * 180) / Math.PI;
    const steps = Math.trunc(carry.current / degreesPerStep);
    if (steps !== 0) {
      carry.current -= steps * degreesPerStep;
      apply(clamp(base() + steps * step));
    }
  };

  const endDrag = (): void => {
    lastAngle.current = null;
    carry.current = 0;
    setDragging(false);
  };

  const commit = (raw: string): void => {
    typed.current = true;
    setText(raw);
    if (raw.trim() === '') {
      valueRef.current = null;
      onChange(null);
      return;
    }
    const n = Number(raw);
    if (Number.isFinite(n)) apply(clamp(n));
  };

  /** On blur, snap the readout back to the value actually stored (clamped). */
  const syncFromValue = (): void => {
    typed.current = false;
    setText(value === null ? '' : value.toFixed(decimals));
  };

  const onKeyDown = (e: React.KeyboardEvent): void => {
    const mult = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault();
      bump(mult);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault();
      bump(-mult);
    }
  };

  const shown = value ?? placeholder ?? null;
  // The pointer angle is cosmetic: it shows position within the current unit.
  const pointerDeg = shown === null ? 0 : ((shown / Math.max(step, 1e-9)) * degreesPerStep) % 360;

  return (
    <div className="card">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-slate-300">{label}</span>
        {unit ? <span className="text-xs muted">{unit}</span> : null}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => bump(-1)}
          aria-label={`Decrease ${label}`}
          className="h-12 w-12 shrink-0 rounded-xl bg-ink-700 text-2xl font-semibold text-slate-100 transition active:scale-95"
        >
          −
        </button>

        <div
          ref={ringRef}
          role="slider"
          tabIndex={0}
          aria-label={`${label} dial`}
          aria-valuenow={value ?? undefined}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuetext={value === null ? 'not set' : `${value.toFixed(decimals)}${unit ? ` ${unit}` : ''}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={onKeyDown}
          className={`relative mx-auto grid h-32 w-32 shrink-0 place-items-center rounded-full outline-none transition ${
            dragging ? 'bg-ink-600' : 'bg-ink-900'
          } ring-2 ${dragging ? 'ring-accent/70' : 'ring-ink-700'} focus-visible:ring-accent/70`}
          style={{ touchAction: 'none', cursor: dragging ? 'grabbing' : 'grab' }}
        >
          <Ticks />

          {/* Rotating indicator */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ transform: `rotate(${pointerDeg}deg)` }}
            aria-hidden
          >
            <div
              className={`absolute left-1/2 top-1.5 h-3.5 w-1 -translate-x-1/2 rounded-full ${
                dragging ? 'bg-accent' : 'bg-slate-400'
              }`}
            />
          </div>

          {/* Typed entry sits in the middle of the dial. */}
          <input
            inputMode="decimal"
            enterKeyHint="next"
            autoFocus={autoFocus}
            value={text}
            onChange={(e) => commit(e.target.value)}
            onBlur={syncFromValue}
            // Arrows step the value here too — otherwise focus landing on the
            // input silently kills keyboard control of the dial around it.
            onKeyDown={onKeyDown}
            onPointerDown={(e) => e.stopPropagation()}
            placeholder={
              placeholder !== null && placeholder !== undefined ? placeholder.toFixed(decimals) : '—'
            }
            aria-label={label}
            className="pointer-events-auto z-10 w-20 bg-transparent text-center text-2xl font-semibold tabular-nums outline-none placeholder:text-slate-600"
          />
        </div>

        <button
          type="button"
          onClick={() => bump(1)}
          aria-label={`Increase ${label}`}
          className="h-12 w-12 shrink-0 rounded-xl bg-ink-700 text-2xl font-semibold text-slate-100 transition active:scale-95"
        >
          +
        </button>
      </div>

      <p className="mt-2 text-center text-[11px] muted">
        Spin the dial, or tap the number to type it
      </p>
    </div>
  );
}

/** Static tick ring — orientation cues so rotation reads as rotation. */
function Ticks() {
  return (
    <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0" aria-hidden>
      {Array.from({ length: 24 }, (_, i) => {
        const a = (i / 24) * TAU - Math.PI / 2;
        const major = i % 6 === 0;
        const r1 = major ? 40 : 43;
        return (
          <line
            key={i}
            x1={50 + Math.cos(a) * r1}
            y1={50 + Math.sin(a) * r1}
            x2={50 + Math.cos(a) * 46}
            y2={50 + Math.sin(a) * 46}
            stroke={major ? '#475569' : '#26323f'}
            strokeWidth={major ? 2 : 1.5}
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}
