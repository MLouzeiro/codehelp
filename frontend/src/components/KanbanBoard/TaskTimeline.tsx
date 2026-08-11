import { Plus, ArrowRight, Edit3, MessageCircle, CheckCircle, ListChecks, Paperclip, ToggleLeft } from 'lucide-react';
import type { KanbanActivity } from '../../types/kanban';

const ACTIVITY_CONFIG: Record<string, { icon: typeof Plus; color: string; bg: string }> = {
  criou: { icon: Plus, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30' },
  moveu: { icon: ArrowRight, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  editou: { icon: Edit3, color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  comentou: { icon: MessageCircle, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/30' },
  concluiu: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30' },
  adicionou_subtarefa: { icon: ListChecks, color: 'text-cyan-500', bg: 'bg-cyan-100 dark:bg-cyan-900/30' },
  subtarefa_toggled: { icon: ToggleLeft, color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800/30' },
  anexou: { icon: Paperclip, color: 'text-pink-500', bg: 'bg-pink-100 dark:bg-pink-900/30' },
};

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `há ${diffMin} min`;
  if (diffH < 24) return `há ${diffH} hora${diffH > 1 ? 's' : ''}`;
  if (diffD < 7) return `há ${diffD} dia${diffD > 1 ? 's' : ''}`;
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' às ' + new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function TaskTimeline({ activities }: { activities: KanbanActivity[] }) {
  if (!activities || activities.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-gray-400 dark:text-slate-500">
        Nenhuma atividade ainda
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200 dark:bg-slate-700" />
      <div className="space-y-4">
        {activities.map((a) => {
          const config = ACTIVITY_CONFIG[a.tipo] || ACTIVITY_CONFIG.editou;
          const Icon = config.icon;
          return (
            <div key={a.id} className="relative flex gap-3">
              <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${config.bg}`}>
                <Icon size={14} className={config.color} />
              </div>
              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {a.usuario && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-codemed-500 flex items-center justify-center text-white text-[9px] font-bold">
                        {a.usuario.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs font-medium text-gray-700 dark:text-slate-200">{a.usuario.name}</span>
                    </div>
                  )}
                  {!a.usuario && (
                    <span className="text-xs font-medium text-gray-500 dark:text-slate-400">Sistema</span>
                  )}
                  <span className="text-[11px] text-gray-400 dark:text-slate-500">{relativeTime(a.createdAt)}</span>
                </div>
                {a.tipo === 'comentou' ? (
                  <div className="mt-1.5 bg-gray-50 dark:bg-slate-800/50 rounded-lg p-2.5 text-sm text-gray-700 dark:text-slate-200 border border-gray-100 dark:border-slate-700/50">
                    {a.descricao}
                  </div>
                ) : a.tipo === 'moveu' ? (
                  <p className="text-xs text-gray-600 dark:text-slate-300 mt-0.5">
                    moveu de <span className="font-medium">{a.deColuna}</span> para <span className="font-medium">{a.paraColuna}</span>
                  </p>
                ) : (
                  <p className="text-xs text-gray-600 dark:text-slate-300 mt-0.5">{a.descricao}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
