# CodeHelp — Documentação do Projeto

## Índice

| Documento | Descrição |
|-----------|-----------|
| [HISTORIA-DO-PROJETO.md](HISTORIA-DO-PROJETO.md) | Linha do tempo real do projeto |
| [ARQUITETURA.md](ARQUITETURA.md) | Arquitetura do sistema |
| [BANCO-DE-DADOS.md](BANCO-DE-DADOS.md) | Schema, tabelas, relacionamentos |
| [AMBIENTES.md](AMBIENTES.md) | Configuração local vs web |
| [SEGURANCA.md](SEGURANCA.md) | Politicas de seguranca |
| [MIGRACAO-BANCO.md](MIGRACAO-BANCO.md) | Processo de migração para Neon |
| [DEPLOY-VERCEL.md](DEPLOY-VERCEL.md) | Deploy na Vercel |
| [CHANGELOG.md](CHANGELOG.md) | Historico de alterações |
| [DECISOES-TECNICAS.md](DECISOES-TECNICAS.md) | ADRs e decisões de arquitetura |
| [RECUPERACAO-E-BACKUP.md](RECUPERACAO-E-BACKUP.md) | Backup e recuperação |

## Visão Geral

**CodeHelp** é um sistema de CRM/Helpdesk com integração WhatsApp, kanban, CRM, analytics e app mobile.

- **Backend**: Node.js + Express + TypeScript
- **Frontend**: React 18 + Vite + Tailwind CSS
- **Mobile**: React Native + Expo
- **Banco**: PostgreSQL (local Docker + Neon web)
- **ORM**: Prisma 5.22
