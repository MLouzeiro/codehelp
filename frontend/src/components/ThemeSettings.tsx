import { useRef, useEffect, useState } from 'react';
import { Settings, Sun, Moon, Minus, Plus, PanelLeftClose, PanelLeftOpen, Rows3, Columns3 } from 'lucide-react';
import { useThemeSettings, COLOR_SCHEMES, type FontScale, type ColorScheme, type SidebarLayout } from '../services/ThemeContext';

const COLOR_LABELS: Record<ColorScheme, string> = {
  blue: 'Azul',
  green: 'Verde',
  purple: 'Roxo',
  orange: 'Laranja',
  gray: 'Cinza',
};

const FONT_LABELS: Record<FontScale, string> = {
  sm: 'A-',
  md: 'A',
  lg: 'A+',
};

const SIDEBAR_OPTIONS: { value: SidebarLayout; label: string; icon: typeof Rows3 }[] = [
  { value: 'vertical', label: 'Vertical', icon: PanelLeftOpen },
  { value: 'horizontal', label: 'Horizontal', icon: Rows3 },
  { value: 'collapsed', label: 'Oculto', icon: PanelLeftClose },
];

export default function ThemeSettings() {
  const { theme, fontScale, colorScheme, sidebarLayout, toggleTheme, setFontScale, setColorScheme, setSidebarLayout } = useThemeSettings();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative z-[150]" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        title="Configurações de aparência"
        className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
      >
        <Settings size={18} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-[200] overflow-hidden animate-slide-down">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100" style={{ fontFamily: 'Khand, sans-serif' }}>
              Aparência
            </span>
          </div>

          <div className="p-4 space-y-5">
            <div>
              <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Tamanho da Fonte</p>
              <div className="flex gap-2">
                {(Object.keys(FONT_LABELS) as FontScale[]).map((size) => (
                  <button
                    key={size}
                    onClick={() => setFontScale(size)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                      fontScale === size
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                    }`}
                  >
                    {FONT_LABELS[size]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Cor do Tema</p>
              <div className="flex gap-2.5">
                {(Object.keys(COLOR_SCHEMES) as ColorScheme[]).map((scheme) => (
                  <button
                    key={scheme}
                    onClick={() => setColorScheme(scheme)}
                    title={COLOR_LABELS[scheme]}
                    className={`w-8 h-8 rounded-full transition-all flex items-center justify-center ${
                      colorScheme === scheme
                        ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-800 scale-110'
                        : 'hover:scale-110'
                    }`}
                    style={{
                      backgroundColor: COLOR_SCHEMES[scheme].primary,
                      boxShadow: colorScheme === scheme ? `0 0 0 2px white, 0 0 0 4px ${COLOR_SCHEMES[scheme].primary}` : undefined,
                    }}
                  >
                    {colorScheme === scheme && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Modo Escuro</p>
              <div className="flex gap-2">
                <button
                  onClick={() => theme === 'dark' && toggleTheme()}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-lg transition-all ${
                    theme === 'light'
                      ? 'bg-white border-2 border-slate-900 text-slate-900 shadow-md'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 border border-transparent'
                  }`}
                >
                  <Sun size={16} />
                  <span className="text-sm font-medium">Claro</span>
                </button>
                <button
                  onClick={() => theme === 'light' && toggleTheme()}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-lg transition-all ${
                    theme === 'dark'
                      ? 'bg-slate-900 border-2 border-white text-white shadow-md'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 border border-transparent'
                  }`}
                >
                  <Moon size={16} />
                  <span className="text-sm font-medium">Escuro</span>
                </button>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Menu Lateral</p>
              <div className="flex gap-2">
                {SIDEBAR_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setSidebarLayout(opt.value)}
                      title={opt.label}
                      className={`flex-1 py-2 rounded-lg text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 ${
                        sidebarLayout === opt.value
                          ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                      }`}
                    >
                      <Icon size={14} />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
