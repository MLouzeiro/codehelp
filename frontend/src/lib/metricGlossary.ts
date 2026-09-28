export interface GlossaryEntry {
  sigla: string;
  nome: string;
  nomeCompleto: string;
  descricao: string;
  comoCalculado: string;
  unidade: string;
  meta?: string;
  interpretacao?: string;
  exemplos?: string[];
}

export const METRIC_GLOSSARY: GlossaryEntry[] = [
  {
    sigla: 'CSAT',
    nome: 'Customer Satisfaction Score',
    nomeCompleto: 'Índice de Satisfação do Cliente',
    descricao: 'Mede o nível de satisfação informado pelo cliente após o atendimento.',
    comoCalculado: 'Média das notas de avaliação (escala 1-5) fornecidas pelos clientes após o encerramento do ticket.',
    unidade: 'Escala de 1 a 5',
    meta: '3.5',
    interpretacao: 'Acima de 3.5 = bom. Abaixo de 3.5 = atenção. Abaixo de 2.5 = crítico.',
    exemplos: ['Cliente avalia 5 = muito satisfeito', 'Cliente avalia 1 = muito insatisfeito'],
  },
  {
    sigla: 'FCR',
    nome: 'First Contact Resolution',
    nomeCompleto: 'Resolução no Primeiro Contato',
    descricao: 'Percentual de chamados resolvidos sem necessidade de novo contato do cliente.',
    comoCalculado: 'Tickets resolvidos sem reabertura / total de tickets com métricas x 100.',
    unidade: 'Percentual (%)',
    meta: '60%',
    interpretacao: 'Acima de 60% = bom. Abaixo de 60% = atenção. Abaixo de 40% = crítico.',
    exemplos: ['FCR 75% = 75 em cada 100 chamados foram resolvidos na primeira vez'],
  },
  {
    sigla: 'SLA',
    nome: 'Service Level Agreement',
    nomeCompleto: 'Acordo de Nível de Serviço',
    descricao: 'Define o prazo ou nível de serviço esperado para atendimento/resolução.',
    comoCalculado: 'Tickets atendidos dentro do prazo / total de tickets x 100.',
    unidade: 'Percentual (%)',
    meta: '95%',
    interpretacao: 'Acima de 95% = dentro da meta. Abaixo de 95% = fora da meta.',
    exemplos: ['SLA 98% = 98 em cada 100 tickets foram atendidos no prazo'],
  },
  {
    sigla: 'TMR',
    nome: 'Tempo Médio de Resolução',
    nomeCompleto: 'Tempo Médio de Resolução',
    descricao: 'Tempo médio entre criação e resolução do ticket.',
    comoCalculado: 'Soma do tempo de resolução de todos os tickets resolvidos / total de tickets resolvidos.',
    unidade: 'Minutos',
    meta: '360 minutos',
    interpretacao: 'Abaixo de 360 min = dentro da meta. Acima = acima da meta.',
    exemplos: ['TMR 240 min = em média, cada ticket leva 4 horas para ser resolvido'],
  },
  {
    sigla: 'TMA',
    nome: 'Tempo Médio de Atendimento',
    nomeCompleto: 'Tempo Médio de Atendimento',
    descricao: 'Tempo médio total do atendimento, incluindo todas as etapas.',
    comoCalculado: 'Soma do tempo total de atendimento / total de tickets.',
    unidade: 'Minutos',
    interpretacao: 'Valor menor indica atendimento mais eficiente.',
    exemplos: ['TMA 180 min = em média, cada atendimento dura 3 horas'],
  },
  {
    sigla: 'TME',
    nome: 'Tempo Médio de Espera',
    nomeCompleto: 'Tempo Médio de Espera do Cliente',
    descricao: 'Tempo médio que o cliente aguarda entre envios de mensagem até resposta do agente.',
    comoCalculado: 'Soma dos tempos de espera do cliente / total de interações com espera.',
    unidade: 'Minutos',
    meta: '30 minutos',
    interpretacao: 'Abaixo de 30 min = boa resposta. Acima = atenção.',
    exemplos: ['TME 15 min = em média, o cliente espera 15 minutos para receber resposta'],
  },
  {
    sigla: 'PR',
    nome: 'Primeira Resposta',
    nomeCompleto: 'Tempo de Primeira Resposta',
    descricao: 'Tempo entre criação do ticket e primeira resposta do analista.',
    comoCalculado: 'Timestamp da primeira mensagem do agente - timestamp de criação do ticket.',
    unidade: 'Minutos',
    meta: '15 minutos',
    interpretacao: 'Abaixo de 15 min = rápido. Acima = atenção.',
    exemplos: ['PR 8 min = o analista respondeu em 8 minutos'],
  },
  {
    sigla: 'NPS',
    nome: 'Net Promoter Score',
    nomeCompleto: 'Indicador de Lealdade do Cliente',
    descricao: 'Indica a probabilidade do cliente recomendar o serviço. Escala de -100 a 100.',
    comoCalculado: '% Promotores (9-10) - % Detratores (0-6).',
    unidade: 'Escala de -100 a 100',
    interpretacao: 'Acimo de 50 = excelente. 0-50 = bom. Abaixo de 0 = precisa melhorar.',
    exemplos: ['NPS 72 = 72% a mais de promotores que detratores'],
  },
  {
    sigla: 'KPI',
    nome: 'Key Performance Indicator',
    nomeCompleto: 'Indicador-Chave de Desempenho',
    descricao: 'Métrica usada para avaliar a eficácia de um processo ou organização.',
    comoCalculado: 'Varia conforme o KPI específico.',
    unidade: 'Variável',
    interpretacao: 'Depende do KPI escolhido.',
    exemplos: ['CSAT é um KPI de satisfação. FCR é um KPI de eficiência.'],
  },
  {
    sigla: 'MTTR',
    nome: 'Mean Time To Resolve',
    nomeCompleto: 'Tempo Médio para Resolver',
    descricao: 'Tempo médio entre a primeira resposta e a resolução do problema.',
    comoCalculado: 'Soma do tempo entre primeira resposta e resolução / total de tickets resolvidos.',
    unidade: 'Minutos',
    interpretacao: 'Valor menor indica resolução mais eficiente.',
    exemplos: ['MTTR 120 min = em média, entre a primeira resposta e a solução levam 2 horas'],
  },
  {
    sigla: 'CHT',
    nome: 'First Response Time',
    nomeCompleto: 'Tempo de Primeira Resposta',
    descricao: 'Alias para PR (Primeira Resposta) em alguns contextos.',
    comoCalculado: 'Igual ao PR.',
    unidade: 'Minutos',
    meta: '15 minutos',
    interpretacao: 'Igual ao PR.',
    exemplos: [],
  },
  {
    sigla: 'IA',
    nome: 'Inteligência Artificial',
    nomeCompleto: 'Inteligência Artificial',
    descricao: 'Sistema de análise automatizada de tickets, conversas e desempenho de analistas.',
    comoCalculado: 'Análise via Claude API com fallback local.',
    unidade: 'N/A',
    interpretacao: 'Usado para triagem, classificação, auditoria e diagnóstico.',
    exemplos: ['IA classifica ticket automaticamente. IA audita atendimento do analista.'],
  },
  {
    sigla: 'FQR',
    nome: 'Frequência de Reaberturas',
    nomeCompleto: 'Frequência de Reaberturas',
    descricao: 'Percentual de chamados encerrados que foram reabertos posteriormente.',
    comoCalculado: 'Tickets com pelo menos uma reabertura / total de tickets encerrados x 100.',
    unidade: 'Percentual (%)',
    meta: '<=5%',
    interpretacao: 'Abaixo de 5% = bom. 5-15% = moderado. Acima de 15% = crítico.',
    exemplos: ['FQR 3% = 3 em cada 100 chamados encerrados foram reabertos'],
  },
  {
    sigla: 'FR',
    nome: 'Frequência de Recorrência',
    nomeCompleto: 'Frequência de Recorrência',
    descricao: 'Percentual de chamados que tratam do mesmo problema reportado anteriormente.',
    comoCalculado: 'Chamados com problema recorrente / total de chamados x 100.',
    unidade: 'Percentual (%)',
    meta: '<=10%',
    interpretacao: 'Abaixo de 10% = bom. 10-25% = moderado. Acima de 25% = crítico.',
    exemplos: ['FR 8% = 8 em cada 100 chamados são sobre problemas já reportados'],
  },
  {
    sigla: 'RR',
    nome: 'Taxa de Retrabalho',
    nomeCompleto: 'Taxa de Retrabalho',
    descricao: 'Percentual de tickets que precisaram de ações adicionais após a primeira resolução.',
    comoCalculado: 'Tickets com retrabalho / total de tickets x 100.',
    unidade: 'Percentual (%)',
    meta: '<=5%',
    interpretacao: 'Abaixo de 5% = bom. 5-10% = atenção. Acima de 10% = crítico.',
    exemplos: ['RR 3% = 3 em cada 100 tickets precisaram de retrabalho'],
  },
];

export interface TrainingCategory {
  id: string;
  nome: string;
  icone: string;
  descricao: string;
  exemplos: string[];
}

export const TRAINING_CATEGORIES: TrainingCategory[] = [
  {
    id: 'conhecimento_tecnico',
    nome: 'Conhecimento Técnico',
    icone: '📚',
    descricao: 'O analista não demonstra domínio suficiente do assunto técnico.',
    exemplos: ['Configuração de sistema', 'Integração com equipamentos', 'Manutenção'],
  },
  {
    id: 'conhecimento_funcional',
    nome: 'Conhecimento Funcional',
    icone: '🖥️',
    descricao: 'Dificuldade em utilizar ou explicar determinada funcionalidade do sistema.',
    exemplos: ['Módulo Financeiro', 'Relatórios', 'Cadastro de pacientes'],
  },
  {
    id: 'diagnostico',
    nome: 'Diagnóstico',
    icone: '🔎',
    descricao: 'Dificuldade em identificar a causa do problema.',
    exemplos: ['Não consegue isolar a causa raiz', 'Confunde sintomas com causas'],
  },
  {
    id: 'resolucao',
    nome: 'Resolução',
    icone: '🛠️',
    descricao: 'Dificuldade em solucionar o problema mesmo após identificar a causa.',
    exemplos: ['Conhece o problema mas não sabe resolver', 'Necessita de intervenção de outro analista'],
  },
  {
    id: 'atendimento',
    nome: 'Atendimento',
    icone: '💬',
    descricao: 'Problemas na condução do atendimento.',
    exemplos: ['Não segue o roteiro de atendimento', 'Não faz perguntas de diagnósticos'],
  },
  {
    id: 'comunicacao',
    nome: 'Comunicação',
    icone: '🗣️',
    descricao: 'Respostas pouco claras, incompletas ou dificuldade em compreender a solicitação.',
    exemplos: ['Linguagem técnica para cliente não técnico', 'Respostas incompletas'],
  },
  {
    id: 'processo',
    nome: 'Processo',
    icone: '🔄',
    descricao: 'Dificuldade em seguir o procedimento correto.',
    exemplos: ['Não registra ações no ticket', 'Não segue fluxo de encerramento'],
  },
  {
    id: 'tempo_sla',
    nome: 'Tempo/SLA',
    icone: '⏱️',
    descricao: 'Dificuldades relacionadas ao tempo de resposta ou cumprimento do SLA.',
    exemplos: ['Demora para responder', 'Deixa tickets sem resposta por muito tempo'],
  },
  {
    id: 'comportamento',
    nome: 'Comportamento',
    icone: '🤝',
    descricao: 'Problemas recorrentes relacionados à postura durante o atendimento.',
    exemplos: ['Falta de empatia', 'Tom inadequado', 'Impaciência'],
  },
  {
    id: 'profissionalismo',
    nome: 'Profissionalismo',
    icone: '👔',
    descricao: 'Problemas relacionados à postura profissional, cordialidade, respeito, empatia ou linguagem.',
    exemplos: ['Linguagem inadequada', 'Falta de respeito', 'Conduta profissional'],
  },
  {
    id: 'assunto_especifico',
    nome: 'Conhecimento sobre Assunto',
    icone: '🧠',
    descricao: 'Necessidade de treinamento sobre determinado assunto específico solicitado pelos clientes.',
    exemplos: ['Integração com equipamento X', 'Cadastro de pacientes', 'Financeiro', 'Faturamento'],
  },
];

export interface CausaProbavel {
  tipo: 'analista' | 'sistema' | 'desenvolvimento' | 'base_conhecimento' | 'processo' | 'cliente';
  label: string;
  descricao: string;
}

export const CAUSAS_PROVEIS: CausaProbavel[] = [
  { tipo: 'analista', label: 'Analista', descricao: 'Problema de conhecimento, condução ou comportamento do analista.' },
  { tipo: 'sistema', label: 'Sistema', descricao: 'Bug ou comportamento incorreto da aplicação.' },
  { tipo: 'desenvolvimento', label: 'Desenvolvimento', descricao: 'Necessidade de desenvolvimento ou correção no código.' },
  { tipo: 'base_conhecimento', label: 'Base de Conhecimento', descricao: 'Falta de documentação ou materiais de referência.' },
  { tipo: 'processo', label: 'Processo', descricao: 'Problema no processo interno de atendimento.' },
  { tipo: 'cliente', label: 'Cliente', descricao: 'Informações insuficientes fornecidas pelo cliente.' },
];

export function getGlossaryEntry(sigla: string): GlossaryEntry | undefined {
  return METRIC_GLOSSARY.find((e) => e.sigla === sigla.toUpperCase());
}

export function getGlossaryBySigla(sigla: string): GlossaryEntry | undefined {
  return METRIC_GLOSSARY.find((e) => e.sigla === sigla.toUpperCase());
}

export function getAllAcronyms(): string[] {
  return METRIC_GLOSSARY.map((e) => e.sigla);
}

export function getTrainingCategory(id: string): TrainingCategory | undefined {
  return TRAINING_CATEGORIES.find((c) => c.id === id);
}
