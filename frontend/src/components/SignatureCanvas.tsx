import { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Eraser, Undo2 } from 'lucide-react';

interface Point {
  x: number;
  y: number;
  pressure?: number;
}

interface SignatureCanvasProps {
  width?: number;
  height?: number;
  strokeColor?: string;
  strokeWidth?: number;
  className?: string;
  onSignatureChange?: (hasContent: boolean) => void;
}

export interface SignatureCanvasHandle {
  getSignatureBase64: () => string | null;
  clear: () => void;
}

const SignatureCanvas = forwardRef<SignatureCanvasHandle, SignatureCanvasProps>(
  (
    {
      width = 500,
      height = 180,
      strokeColor = '#1e3a8a',
      strokeWidth = 2.5,
      className = '',
      onSignatureChange,
    },
    ref,
  ) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const pathsRef = useRef<Point[][]>([]);
    const currentPath = useRef<Point[]>([]);
    const lastPoint = useRef<Point | null>(null);
    const isDrawingRef = useRef(false);
    const animFrame = useRef<number>(0);
    const strokeColorRef = useRef(strokeColor);
    const strokeWidthRef = useRef(strokeWidth);
    const [pathsCount, setPathsCount] = useState(0);
    const [base64, setBase64] = useState<string | null>(null);

    // Sync refs with props
    useEffect(() => { strokeColorRef.current = strokeColor; }, [strokeColor]);
    useEffect(() => { strokeWidthRef.current = strokeWidth; }, [strokeWidth]);

    const drawAllPaths = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      ctx.strokeStyle = strokeColorRef.current;
      ctx.lineWidth = strokeWidthRef.current;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const allPaths = [...pathsRef.current];
      if (currentPath.current.length > 0) {
        allPaths.push(currentPath.current);
      }

      for (const path of allPaths) {
        if (path.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(path[0].x, path[0].y);

        if (path.length === 2) {
          ctx.lineTo(path[1].x, path[1].y);
        } else {
          for (let i = 1; i < path.length - 1; i++) {
            const midX = (path[i].x + path[i + 1].x) / 2;
            const midY = (path[i].y + path[i + 1].y) / 2;
            ctx.quadraticCurveTo(path[i].x, path[i].y, midX, midY);
          }
          const last = path[path.length - 1];
          ctx.lineTo(last.x, last.y);
        }
        ctx.stroke();
      }
    }, []);

    const captureBase64 = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const hasContent = imageData.data.some((pixel, i) => i % 4 === 3 && pixel > 0);
      if (!hasContent) {
        setBase64(null);
        return;
      }
      setBase64(canvas.toDataURL('image/png'));
    }, []);

    // Redraw + capture on pathsCount change (triggered by pointer up, undo, clear)
    useEffect(() => {
      drawAllPaths();
      captureBase64();
      onSignatureChange?.(pathsRef.current.length > 0);
    }, [pathsCount, drawAllPaths, captureBase64, onSignatureChange]);

    // ResizeObserver — stable, runs once
    useEffect(() => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const initCanvas = () => {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        const newW = Math.round(rect.width * dpr);
        const newH = Math.round(rect.height * dpr);
        // Only set dimensions if they actually changed — setting w/h clears the canvas
        if (canvas.width !== newW || canvas.height !== newH) {
          canvas.width = newW;
          canvas.height = newH;
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        drawAllPaths();
      };

      initCanvas();

      const ro = new ResizeObserver(() => {
        initCanvas();
      });
      ro.observe(container);

      return () => ro.disconnect();
    }, [drawAllPaths]);

    const getCanvasPoint = useCallback((e: React.PointerEvent): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      // Return CSS pixel coordinates — ctx.scale(dpr) handles the conversion
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        pressure: e.pressure || 0.5,
      };
    }, []);

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      isDrawingRef.current = true;
      const point = getCanvasPoint(e);
      currentPath.current = [point];
      lastPoint.current = point;
    }, [getCanvasPoint]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
      if (!isDrawingRef.current) return;
      e.preventDefault();

      const point = getCanvasPoint(e);
      const prev = lastPoint.current;
      if (prev) {
        const dx = point.x - prev.x;
        const dy = point.y - prev.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 2) return;
      }

      currentPath.current.push(point);
      lastPoint.current = point;

      cancelAnimationFrame(animFrame.current);
      animFrame.current = requestAnimationFrame(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.strokeStyle = strokeColorRef.current;
        ctx.lineWidth = strokeWidthRef.current;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const path = currentPath.current;
        if (path.length >= 2) {
          const i = path.length - 2;
          const prev2 = path[i];
          const curr = path[i + 1];
          ctx.beginPath();
          ctx.moveTo(prev2.x, prev2.y);
          ctx.lineTo(curr.x, curr.y);
          ctx.stroke();
        }
      });
    }, [getCanvasPoint]);

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
      if (!isDrawingRef.current) return;
      e.preventDefault();
      isDrawingRef.current = false;
      if (currentPath.current.length > 0) {
        pathsRef.current = [...pathsRef.current, [...currentPath.current]];
      }
      currentPath.current = [];
      lastPoint.current = null;
      setPathsCount(c => c + 1);
    }, []);

    const handlePointerCancel = useCallback(() => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      if (currentPath.current.length > 0) {
        pathsRef.current = [...pathsRef.current, [...currentPath.current]];
      }
      currentPath.current = [];
      lastPoint.current = null;
      setPathsCount(c => c + 1);
    }, []);

    const handleUndo = useCallback(() => {
      pathsRef.current = pathsRef.current.slice(0, -1);
      setPathsCount(c => c + 1);
    }, []);

    const handleClear = useCallback(() => {
      pathsRef.current = [];
      currentPath.current = [];
      lastPoint.current = null;
      setBase64(null);
      setPathsCount(c => c + 1);
    }, []);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      getSignatureBase64: (): string | null => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const hasContent = imageData.data.some((pixel, i) => i % 4 === 3 && pixel > 0);
        if (!hasContent) return null;
        return canvas.toDataURL('image/png');
      },
      clear: handleClear,
    }), [handleClear]);

    return (
      <div className={className} ref={containerRef}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300" style={{ fontFamily: 'Lexend, sans-serif' }}>
            Assinatura
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleUndo}
              disabled={pathsRef.current.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[36px]"
              style={{ fontFamily: 'Lexend, sans-serif' }}
            >
              <Undo2 size={14} />
              Desfazer
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={pathsRef.current.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[36px]"
              style={{ fontFamily: 'Lexend, sans-serif' }}
            >
              <Eraser size={14} />
              Limpar
            </button>
          </div>
        </div>

        <div className="relative">
          <canvas
            ref={canvasRef}
            className="w-full border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 cursor-crosshair"
            style={{
              touchAction: 'none',
              height: `${height}px`,
              WebkitUserSelect: 'none',
              userSelect: 'none',
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
          />
          {pathsCount === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-sm text-slate-400 dark:text-slate-500" style={{ fontFamily: 'Lexend, sans-serif' }}>
                  Toque ou clique e arraste para assinar
                </p>
                <p className="text-xs text-slate-300 dark:text-slate-600 mt-1" style={{ fontFamily: 'Lexend, sans-serif' }}>
                  Funciona com dedo no celular e mouse no computador
                </p>
              </div>
            </div>
          )}
        </div>

        <input type="hidden" data-signature-base64={base64 || ''} />
      </div>
    );
  },
);

SignatureCanvas.displayName = 'SignatureCanvas';

export default SignatureCanvas;

export function useSignatureBase64(containerRef: React.RefObject<HTMLDivElement>): string | null {
  const input = containerRef.current?.querySelector('input[data-signature-base64]') as HTMLInputElement | null;
  return input?.value || null;
}
