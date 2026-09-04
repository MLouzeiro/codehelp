import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Zap, Filter, Play, X, AlertCircle, MessageSquare, Bell, Tag, ArrowRightLeft, UserPlus, GitBranch } from 'lucide-react';

const TRIGGER_ICONS: Record<string, any> = {
  novo_ticket: Zap,
  msg_recebida: MessageSquare,
  status_alterado: ArrowRightLeft,
  sla_alerta: AlertCircle,
  csat_recebido: Bell,
};

const TRIGGER_LABELS: Record<string, string> = {
  novo_ticket: 'Novo Ticket',
  msg_recebida: 'Mensagem Recebida',
  status_alterado: 'Status Alterado',
  sla_alerta: 'Alerta SLA',
  csat_recebido: 'CSAT Recebido',
};

const ACTION_ICONS: Record<string, any> = {
  definir_categoria: Tag,
  definir_prioridade: ArrowRightLeft,
  atribuir_usuario: UserPlus,
  mudar_etapa: GitBranch,
  enviar_msg: MessageSquare,
  escalar_fila: GitBranch,
  notificar: Bell,
  adicionar_tag: Tag,
};

const ACTION_LABELS: Record<string, string> = {
  definir_categoria: 'Definir Categoria',
  definir_prioridade: 'Definir Prioridade',
  atribuir_usuario: 'Atribuir Usuário',
  mudar_etapa: 'Mudar Etapa',
  enviar_msg: 'Enviar Mensagem',
  escalar_fila: 'Escalar p/ Fila',
  notificar: 'Notificar',
  adicionar_tag: 'Adicionar Tag',
};

function TriggerNode({ data }: NodeProps) {
  const Icon = TRIGGER_ICONS[data.trigger as string] || Zap;
  const label = TRIGGER_LABELS[data.trigger as string] || data.trigger;
  return (
    <div className="relative">
      <div className="bg-amber-500 text-white rounded-xl px-4 py-3 shadow-lg border-2 border-amber-600 min-w-[180px]">
        <div className="flex items-center gap-2">
          <Icon size={16} />
          <span className="font-semibold text-sm" style={{ fontFamily: 'Lexend, sans-serif' }}>{label}</span>
        </div>
        {data.descricao && <p className="text-[10px] text-amber-100 mt-1">{data.descricao}</p>}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-amber-500 !w-3 !h-3 !border-2 !border-white" />
    </div>
  );
}

function ConditionNode({ data }: NodeProps) {
  const index = data.index ?? 0;
  const total = data.total ?? 1;
  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} className="!bg-blue-500 !w-3 !h-3 !border-2 !border-white" />
      <div className="bg-blue-500 text-white rounded-xl px-4 py-3 shadow-lg border-2 border-blue-600 min-w-[200px]">
        <div className="flex items-center gap-2">
          <Filter size={16} />
          <span className="font-semibold text-sm" style={{ fontFamily: 'Lexend, sans-serif' }}>Condição {index + 1}/{total}</span>
        </div>
        <div className="mt-2 text-[11px] text-blue-100 space-y-0.5">
          <div><span className="text-blue-200">Campo:</span> {data.campo || '—'}</div>
          <div><span className="text-blue-200">Operador:</span> {data.operador || '—'}</div>
          <div><span className="text-blue-200">Valor:</span> {data.valor || '—'}</div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500 !w-3 !h-3 !border-2 !border-white" />
    </div>
  );
}

function ActionNode({ data }: NodeProps) {
  const Icon = ACTION_ICONS[data.actionType as string] || Play;
  const label = ACTION_LABELS[data.actionType as string] || data.actionType;
  const params = data.parametros as Record<string, string> || {};
  const paramEntries = Object.entries(params).filter(([, v]) => v);
  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} className="!bg-emerald-500 !w-3 !h-3 !border-2 !border-white" />
      <div className="bg-emerald-500 text-white rounded-xl px-4 py-3 shadow-lg border-2 border-emerald-600 min-w-[200px]">
        <div className="flex items-center gap-2">
          <Icon size={16} />
          <span className="font-semibold text-sm" style={{ fontFamily: 'Lexend, sans-serif' }}>{label}</span>
        </div>
        {paramEntries.length > 0 && (
          <div className="mt-2 text-[11px] text-emerald-100 space-y-0.5">
            {paramEntries.map(([k, v]) => (
              <div key={k}><span className="text-emerald-200">{k}:</span> {String(v).slice(0, 40)}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LogicNode({ data }: NodeProps) {
  const op = (data.operator as string) || 'all';
  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} className="!bg-violet-500 !w-3 !h-3 !border-2 !border-white" />
      <div className="bg-violet-500 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg border-2 border-violet-600 font-bold text-sm">
        {op === 'all' ? 'AND' : 'OR'}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-violet-500 !w-3 !h-3 !border-2 !border-white" />
    </div>
  );
}

export const nodeTypes = {
  trigger: TriggerNode,
  condition: ConditionNode,
  action: ActionNode,
  logic: LogicNode,
};
