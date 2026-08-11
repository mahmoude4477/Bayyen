"use client";

import { useMemo, useRef, useState } from "react";
import { Eraser, RotateCcw, Sparkles } from "lucide-react";
import { getStroke } from "perfect-freehand";
import { correctInkStroke, getSvgPathFromStroke, type InkPoint, type InkStroke } from "@/lib/ink";

const VIEW_WIDTH = 900;
const VIEW_HEIGHT = 260;

export function InkPad({ value, onChange }: { value: InkStroke[]; onChange: (strokes: InkStroke[]) => void }) {
  const surfaceRef = useRef<SVGSVGElement>(null);
  const currentRef = useRef<InkPoint[]>([]);
  const activePointerRef = useRef<number | null>(null);
  const [current, setCurrent] = useState<InkPoint[]>([]);
  const visibleStrokes = useMemo(() => [...value.map((stroke) => stroke.corrected), ...(current.length ? [current] : [])], [current, value]);

  function pointFromEvent(event: React.PointerEvent<SVGSVGElement>): InkPoint {
    const bounds = surfaceRef.current!.getBoundingClientRect();
    return [
      ((event.clientX - bounds.left) / bounds.width) * VIEW_WIDTH,
      ((event.clientY - bounds.top) / bounds.height) * VIEW_HEIGHT,
      event.pressure || 0.5,
    ];
  }

  function finishStroke(event: React.PointerEvent<SVGSVGElement>) {
    if (activePointerRef.current !== event.pointerId) return;
    activePointerRef.current = null;
    if (!currentRef.current.length) return;
    const finalPoints = [...currentRef.current, pointFromEvent(event)];
    onChange([...value, correctInkStroke(finalPoints)]);
    currentRef.current = [];
    setCurrent([]);
  }

  return (
    <div className="ink-pad">
      <div className="ink-toolbar">
        <span><Sparkles size={15} /> تنعيم تلقائي ومسـطرة ذكية</span>
        <div>
          <button type="button" disabled={!value.length} onClick={() => onChange(value.slice(0, -1))}><RotateCcw size={15} /> تراجع</button>
          <button type="button" disabled={!value.length} onClick={() => onChange([])}><Eraser size={15} /> مسح</button>
        </div>
      </div>
      <svg
        ref={surfaceRef}
        className="ink-surface"
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        role="img"
        aria-label="لوحة كتابة الإجابة بالقلم أو الإصبع"
        onPointerDown={(event) => {
          activePointerRef.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
          const firstPoint = pointFromEvent(event);
          currentRef.current = [firstPoint];
          setCurrent([firstPoint]);
        }}
        onPointerMove={(event) => {
          if (activePointerRef.current !== event.pointerId) return;
          const events = event.nativeEvent.getCoalescedEvents?.() ?? [event.nativeEvent];
          const bounds = surfaceRef.current!.getBoundingClientRect();
          const nextPoints = [...currentRef.current, ...events.map((item): InkPoint => [
            ((item.clientX - bounds.left) / bounds.width) * VIEW_WIDTH,
            ((item.clientY - bounds.top) / bounds.height) * VIEW_HEIGHT,
            item.pressure || 0.5,
          ])];
          currentRef.current = nextPoints;
          setCurrent(nextPoints);
        }}
        onPointerUp={finishStroke}
        onPointerCancel={() => {
          activePointerRef.current = null;
          currentRef.current = [];
          setCurrent([]);
        }}
      >
        <path className="ink-guide" d="M40 210 H860" />
        {visibleStrokes.map((points, index) => {
          const outline = getStroke(points, { size: 10, thinning: 0.25, smoothing: 0.85, streamline: 0.72, simulatePressure: false });
          return <path className="ink-stroke" d={getSvgPathFromStroke(outline)} key={index} />;
        })}
      </svg>
      <small>{value.some((stroke) => stroke.snapped) ? "تم تقويم الخطوط المتعرجة القريبة من الخط المستقيم." : "اكتب طبيعيًا؛ تُنعّم الحواف مع الاحتفاظ بالحركة الأصلية."}</small>
    </div>
  );
}
