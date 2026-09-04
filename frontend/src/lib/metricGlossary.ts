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
    nomeCompleto: 'Indice de Satisfacao do Cliente',
    descricao: 'Mede o nivel de satisfacao informado pelo cliente apos o atendimento.',
    comoCalculado: 'Media das notas de avaliacao (escala 1-5) fornecidas pelos clientes apos o encerramento do ticket.',
    unidade: 'Escala de 1 a 5',
    meta: '3.5',
    interpretacao: 'Acima de 3.5 = bom. Abaixo de 3.5 = atencao. Abaixo de 2.5 = critico.',
    exemplos: ['Cliente avalia 5 = muito satisfeito', 'Cliente avalia 1 = muito insatisfeito'],
  },
  {
    sigla: 'FCR',
    nome: 'First Contact Resolution',
    nomeCompleto: 'Resolucao no Primeiro Contato',
    descricao: 'Percentual de chamados resolvidos sem necessidade de novo contato do cliente.',
    comoCalculado: 'Tickets resolvidos sem reabertura / total de tickets com metricas x 100.',
    unidade: 'Percentual (%)',
    meta: '60%',
    interpretacao: 'Acima de 60% = bom. Abaixo de 60% = atencao. Abaixo de 40% = critico.',
    exemplos: ['FCR 75% = 75 em cada 100 chamados foram resolvidos na primeira vez'],
  },
  {
    sigla: 'SLA',
    nome: 'Service Level Agreement',
    nomeCompleto: 'Acordo de Nivel de Servico',
    descricao: 'Define o prazo ou nivel de servico esperado para atendimento/resolucao.',
    comoCalculado: 'Tickets atendidos dentro do prazo / total de tickets x 100.',
    unidade: 'Percentual (%)',
    meta: '95%',
    interpretacao: 'Acima de 95% = dentro da meta. Abaixo de 95% = fora da meta.',
    exemplos: ['SLA 98% = 98 em cada 100 tickets foram atendidos no prazo'],
  },
  {
    sigla: 'TMR',
    nome: 'Tempo Medio de Resolucao',
    nomeCompleto: 'Tempo Medio de Resolucao',
    descricao: 'Tempo medio entre criacao e resolucao do ticket.',
    comoCalculado: 'Soma do tempo de resolucao de todos os tickets resolvidos / total de tickets resolvidos.',
    unidade: 'Minutos',
    meta: '360 minutos',
    interpretacao: 'Abaixo de 360 min = dentro da meta. Acima = acima da meta.',
    exemplos: ['TMR 240 min = em media, cada ticket leva 4 horas para ser resolvido'],
  },
  {
    sigla: 'TMA',
    nome: 'Tempo Medio de Atendimento',
    nomeCompleto: 'Tempo Medio de Atendimento',
    descricao: 'Tempo medio total do atendimento, incluindo todas as etapas.',
    comoCalculado: 'Soma do tempo total de atendimento / total de tickets.',
    unidade: 'Minutos',
    interpretacao: 'Valor menor indica atendimento mais eficiente.',
    exemplos: ['TMA 180 min = em media, cada atendimento dura 3 horas'],
  },
  {
    sigla: 'TME',
    nome: 'Tempo Medio de Espera',
    nomeCompleto: 'Tempo Medio de Espera do Cliente',
    descricao: 'Tempo medio que o cliente aguarda entre envios de mensagem ate resposta do agente.',
    comoCalculado: 'Soma dos tempos de espera do cliente / total de interacoes com espera.',
    unidade: 'Minutos',
    meta: '30 minutos',
    interpretacao: 'Abaixo de 30 min = boa resposta. Acima = atencao.',
    exemplos: ['TME 15 min = em media, o cliente espera 15 minutos para receber resposta'],
  },
  {
    sigla: 'PR',
    nome: 'Primeira Resposta',
    nomeCompleto: 'Tempo de Primeira Resposta',
    descricao: 'Tempo entre criacao do ticket e primeira resposta do analista.',
    comoCalculado: 'Timestamp da primeira mensagem do agente - timestamp de criacao do ticket.',
    unidade: 'Minutos',
    meta: '15 minutos',
    interpretacao: 'Abaixo de 15 min = rapido. Acima = atencao.',
    exemplos: ['PR 8 min = o analista respondeu em 8 minutos'],
  },
  {
    sigla: 'NPS',
    nome: 'Net Promoter Score',
    nomeCompleto: 'Indicador de Lealdade do Cliente',
    descricao: 'Indica a probabilidade do cliente recomendar o servico. Escala de -100 a 100.',
    comoCalculado: '% Promotores (9-10) - % Detratores (0-6).',
    unidade: 'Escala de -100 a 100',
    interpretacao: 'Acimo de 50 = excelente. 0-50 = bom. Abaixo de 0 = precisa melhorar.',
    exemplos: ['NPS 72 = 72% a mais de promotores que detratores'],
  },
  {
    sigla: 'KPI',
    nome: 'Key Performance Indicator',
    nomeCompleto: 'Indicador-Chave de Desempenho',
    descricao: 'Metrica usada para avaliar a eficacia de um processo ou organizacao.',
    comoCalculado: 'Varia conforme o KPI especifico.',
    unidade: 'Variavel',
    interpretacao: 'Depende do KPI escolhido.',
    exemplos: ['CSAT e um KPI de satisfacao. FCR e um KPI de eficiencia.'],
  },
  {
    sigla: 'MTTR',
    nome: 'Mean Time To Resolve',
    nomeCompleto: 'Tempo Medio para Resolver',
    descricao: 'Tempo medio entre a primeira resposta e a resolucao do problema.',
    comoCalculado: 'Soma do tempo entre primeira resposta e resolucao / total de tickets resolvidos.',
    unidade: 'Minutos',
    interpretacao: 'Valor menor indica resolucao mais eficiente.',
    exemplos: ['MTTR 120 min = em media, entre a primeira resposta e a solucao levam 2 horas'],
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
    nome: 'Inteligencia Artificial',
    nomeCompleto: 'Inteligencia Artificial',
    descricao: 'Sistema de analise automatizada de tickets, conversas e desempenho de analistas.',
    comoCalculado: 'Analise via Claude API com fallback local.',
    unidade: 'N/A',
    interpretacao: 'Usado para triagem, classificacao, auditoria e diagnostico.',
    exemplos: ['IA classifica ticket automaticamente. IA audita atendimento do analista.'],
  },
  {
    sigla: 'FQR',
    nome: 'Frequencia de Reaberturas',
    nomeCompleto: 'Frequencia de Reaberturas',
    descricao: 'Percentual de chamados encerrados que foram reabertos posteriormente.',
    comoCalculado: 'Tickets com pelo menos uma reabertura / total de tickets encerrados x 100.',
    unidade: 'Percentual (%)',
    meta: '<=5%',
    interpretacao: 'Abaixo de 5% = bom. 5-15% = moderado. Acima de 15% = critico.',
    exemplos: ['FQR 3% = 3 em cada 100 chamados encerrados foram reabertos'],
  },
  {
    sigla: 'FR',
    nome: 'Frequencia de Recorrencia',
    nomeCompleto: 'Frequencia de Recorrencia',
    descricao: 'Percentual de chamados que tratam do mesmo problema reportado anteriormente.',
    comoCalculado: 'Chamados com problema recorrente / total de chamados x 100.',
    unidade: 'Percentual (%)',
    meta: '<=10%',
    interpretacao: 'Abaixo de 10% = bom. 10-25% = moderado. Acima de 25% = critico.',
    exemplos: ['FR 8% = 8 em cada 100 chamados sao sobre problemas ja reportados'],
  },
  {
    sigla: 'RR',
    nome: 'Taxa de Retrabalho',
    nomeCompleto: 'Taxa de Retrabalho',
    descricao: 'Percentual de tickets que precisaram de acoes adicionais apos a primeira resolucao.',
    comoCalculado: 'Tickets com retrabalho / total de tickets x 100.',
    unidade: 'Percentual (%)',
    meta: '<=5%',
    interpretacao: 'Abaixo de 5% = bom. 5-10% = atencao. Acima de 10% = critico.',
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
    nome: 'Conhecimento Tecnico',
    icone: '📚',
    descricao: 'O analista nao demonstra dominio suficiente do assunto tecnico.',
    exemplos: ['Configuracao de sistema', 'Integracao com equipamentos', 'Manutencao'],
  },
  {
    id: 'conhecimento_funcional',
    nome: 'Conhecimento Funcional',
    icone: '🖥️',
    descricao: 'Dificuldade em utilizar ou explicar determinada funcionalidade do sistema.',
    exemplos: ['Modulo Financeiro', 'Relatorios', 'Cadastro de pacientes'],
  },
  {
    id: 'diagnostico',
    nome: 'Diagnostico',
    icone: '🔎',
    descricao: 'Dificuldade em identificar a causa do problema.',
    exemplos: ['Nao consegue isolar a causa raiz', 'Confunde sintomas com causas'],
  },
  {
    id: 'resolucao',
    nome: 'Resolucao',
    icone: '🛠️',
    descricao: 'Dificuldade em solucionar o problema mesmo apos identificar a causa.',
    exemplos: ['Conhece o problema mas nao sabe resolver', 'Necessita de intervencao de outro analista'],
  },
  {
    id: 'atendimento',
    nome: 'Atendimento',
    icone: '💬',
    descricao: 'Problemas na conducao do atendimento.',
    exemplos: ['Nao segue o roteiro de atendimento', 'Nao faz perguntas de diagnosticos'],
  },
  {
    id: 'comunicacao',
    nome: 'Comunicacao',
    icone: '🗣️',
    descricao: 'Respostas pouco claras, incompletas ou dificuldade em compreender a solicitacao.',
    exemplos: ['Linguagem tecnica para cliente nao tecnico', 'Respostas incompletas'],
  },
  {
    id: 'processo',
    nome: 'Processo',
    icone: '🔄',
    descricao: 'Dificuldade em seguir o procedimento correto.',
    exemplos: ['Nao registra acoes no ticket', 'Nao segue fluxo de encerramento'],
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
    descricao: 'Problemas recorrentes relacionados a postura durante o atendimento.',
    exemplos: ['Falta de empatia', 'Tom inadequado', 'Impaciencia'],
  },
  {
    id: 'profissionalismo',
    nome: 'Profissionalismo',
    icone: '👔',
    descricao: 'Problemas relacionados a postura profissional, cordialidade, respeito, empatia ou linguagem.',
    exemplos: ['Linguagem inadequada', 'Falta de respeito', 'Conduta profissional'],
  },
  {
    id: 'assunto_especifico',
    nome: 'Conhecimento sobre Assunto',
    icone: '🧠',
    descricao: 'Necessidade de treinamento sobre determinado assunto especifico solicitado pelos clientes.',
    exemplos: ['Integracao com equipamento X', 'Cadastro de pacientes', 'Financeiro', 'Faturamento'],
  },
];

export interface CausaProbavel {
  tipo: 'analista' | 'sistema' | 'desenvolvimento' | 'base_conhecimento' | 'processo' | 'cliente';
  label: string;
  descricao: string;
}

export const CAUSAS_PROVEIS: CausaProbavel[] = [
  { tipo: 'analista', label: 'Analista', descricao: 'Problema de conhecimento, conducao ou comportamento do analista.' },
  { tipo: 'sistema', label: 'Sistema', descricao: 'Bug ou comportamento incorreto da aplicacao.' },
  { tipo: 'desenvolvimento', label: 'Desenvolvimento', descricao: 'Necessidade de desenvolvimento ou correcao no codigo.' },
  { tipo: 'base_conhecimento', label: 'Base de Conhecimento', descricao: 'Falta de documentacao ou materiais de referencia.' },
  { tipo: 'processo', label: 'Processo', descricao: 'Problema no processo interno de atendimento.' },
  { tipo: 'cliente', label: 'Cliente', descricao: 'Informacoes insuficientes fornecidas pelo cliente.' },
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
