import cron from 'node-cron';
import { env } from '../../config/env';
import prisma from '../../config/database';
import {
  gerarSugestoesVendas,
  classificarTicketsPendentes,
  analisarOsAtrasadas,
  sugerirPrioridadesTarefas,
  robotPodeExecutar,
} from './ai.service';

interface RobotExecution {
  robotId: string;
  robotSlug: string;
  robotNome: string;
  startedAt: Date;
  finishedAt?: Date;
  success: boolean;
  details?: string;
  itemsProcessed?: number;
  error?: string;
}

const executionLog: RobotExecution[] = [];
const MAX_LOG_SIZE = 1000;

function logExecution(execution: RobotExecution): void {
  executionLog.unshift(execution);
  if (executionLog.length > MAX_LOG_SIZE) {
    executionLog.pop();
  }
}

export async function executarRobot(
  slug: string,
  nome: string,
  fn: () => Promise<any>
): Promise<void> {
  const robot = await prisma.robot.findUnique({ where: { slug } });
  if (!robot) return;

  const execution: RobotExecution = {
    robotId: robot.id,
    robotSlug: slug,
    robotNome: nome,
    startedAt: new Date(),
    success: false,
  };

  try {
    if (!(await robotPodeExecutar(slug))) {
      execution.details = 'Robot não pode executar (inativo ou fora de horário)';
      execution.finishedAt = new Date();
      logExecution(execution);
      return;
    }

    const result = await fn();
    execution.success = true;
    execution.finishedAt = new Date();
    
    if (result && typeof result === 'object') {
      if ('classificados' in result) {
        execution.itemsProcessed = result.classificados;
        execution.details = `${result.classificados} tickets classificados`;
      } else if ('alerts' in result) {
        execution.itemsProcessed = result.alerts?.length || 0;
        execution.details = `${result.alerts?.length || 0} alertas de OS encontrados`;
      } else if ('sugestoes' in result) {
        execution.itemsProcessed = result.sugestoes?.length || 0;
        execution.details = `${result.sugestoes?.length || 0} sugestões geradas`;
      }
    }

    logExecution(execution);
    console.log(`[Robot Scheduler] ${nome} executado com sucesso: ${execution.details}`);
  } catch (error: any) {
    execution.success = false;
    execution.error = error.message;
    execution.finishedAt = new Date();
    logExecution(execution);
    console.error(`[Robot Scheduler] Erro ao executar ${nome}:`, error.message);
  }
}

export function getExecutionLog(limit: number = 50): RobotExecution[] {
  return executionLog.slice(0, limit);
}

export function getRobotStats(): Record<string, { executions: number; success: number; failed: number; lastExecution?: Date }> {
  const stats: Record<string, { executions: number; success: number; failed: number; lastExecution?: Date }> = {};

  for (const execution of executionLog) {
    if (!stats[execution.robotSlug]) {
      stats[execution.robotSlug] = {
        executions: 0,
        success: 0,
        failed: 0,
      };
    }

    stats[execution.robotSlug].executions++;
    if (execution.success) {
      stats[execution.robotSlug].success++;
    } else {
      stats[execution.robotSlug].failed++;
    }

    if (!stats[execution.robotSlug].lastExecution || execution.startedAt > stats[execution.robotSlug].lastExecution!) {
      stats[execution.robotSlug].lastExecution = execution.startedAt;
    }
  }

  return stats;
}

export function startRobotScheduler(): void {
  console.log('[Robot Scheduler] Iniciando scheduler de robôs...');

  cron.schedule('*/30 * * * *', async () => {
    await executarRobot('vendas', 'Assistente de Vendas', gerarSugestoesVendas);
  }, {
    timezone: env.timezone,
  });

  cron.schedule('*/15 * * * *', async () => {
    await executarRobot('classificador', 'Classificador de Tickets', classificarTicketsPendentes);
  }, {
    timezone: env.timezone,
  });

  cron.schedule('0 */2 * * *', async () => {
    await executarRobot('os-analyst', 'Analista de OS', async () => {
      const alerts = await analisarOsAtrasadas();
      return { alerts };
    });
  }, {
    timezone: env.timezone,
  });

  cron.schedule('*/45 * * * *', async () => {
    await executarRobot('tarefas', 'Assistente de Tarefas', async () => {
      const sugestoes = await sugerirPrioridadesTarefas();
      return { sugestoes };
    });
  }, {
    timezone: env.timezone,
  });

  console.log('[Robot Scheduler] Scheduler iniciado com sucesso');
  console.log('[Robot Scheduler] Vendas: a cada 30 minutos');
  console.log('[Robot Scheduler] Classificador: a cada 15 minutos');
  console.log('[Robot Scheduler] Analista OS: a cada 2 horas');
  console.log('[Robot Scheduler] Tarefas: a cada 45 minutos');
}
