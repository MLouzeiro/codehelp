import { useRef, useEffect, useState, useCallback } from 'react';
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

export default function SignatureCanvas({
  width = 500,
  height = 180,
  strokeColor = '#1e3a8a',
  strokeWidth = 2.5,
  className = '',
  onSignatureChange,
}: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [paths, setPaths] = useState<Point[][]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const currentPath = useRef<Point[]>([]);
  const lastPoint = useRef<Point | null>(null);
  const animFrame = useRef<number>(0);

  const getCanvasPoint = useCallback((e: React.TouchEvent | React.MouseEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
        pressure: (touch as any).force || 0.5,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      pressure: 0.5,
    };
  }, []);

  const drawAllPaths = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const allPaths = [...paths];
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
  }, [paths, strokeColor, strokeWidth]);

  useEffect(() => {
    drawAllPaths();
    onSignatureChange?.(paths.length > 0);
  }, [paths, drawAllPaths, onSignatureChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);

    drawAllPaths();
  }, []);

  const handleStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if ('touches' in e) e.preventDefault();
    setIsDrawing(true);
    const point = getCanvasPoint(e);
    currentPath.current = [point];
    lastPoint.current = point;
  }, [getCanvasPoint]);

  const handleMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing) return;
    if ('touches' in e) e.preventDefault();

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

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
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
  }, [isDrawing, getCanvasPoint, strokeColor, strokeWidth]);

  const handleEnd = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentPath.current.length > 0) {
      setPaths(prev => [...prev, [...currentPath.current]]);
    }
    currentPath.current = [];
    lastPoint.current = null;
  }, [isDrawing]);

  const handleUndo = () => {
    setPaths(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPaths([]);
    currentPath.current = [];
    lastPoint.current = null;
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const getBase64 = (): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const hasContent = imageData.data.some((pixel, i) => i % 4 === 3 && pixel > 0);
    if (!hasContent) return null;

    return canvas.toDataURL('image/png');
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300" style={{ fontFamily: 'Lexend, sans-serif' }}>
          Assinatura
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleUndo}
            disabled={paths.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[36px]"
            style={{ fontFamily: 'Lexend, sans-serif' }}
          >
            <Undo2 size={14} />
            Desfazer
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={paths.length === 0}
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
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
        />
        {paths.length === 0 && (
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

      <input type="hidden" data-signature-base64={getBase64() || ''} />
    </div>
  );
}

export function useSignatureBase64(containerRef: React.RefObject<HTMLDivElement>): string | null {
  const input = containerRef.current?.querySelector('input[data-signature-base64]') as HTMLInputElement | null;
  return input?.value || null;
}
