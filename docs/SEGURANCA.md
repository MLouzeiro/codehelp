# Segurança

## Autenticação

- **JWT**: Access token (15min) + Refresh token (7d)
- **Session Token**: UUID vinculado ao login (impede multi-dispositivo)
- **Hash**: bcryptjs com 12 rounds
- **Logout**: Invalidação server-side do sessionToken

## Autorização (RBAC)

| Role | Nível | Permissões |
|------|-------|------------|
| `solicitante` | 1 | Abrir chamados, ver próprios tickets |
| `agente` | 2 | Atender tickets, editar KB |
| `supervisor` | 3 | Relatórios, publicar KB, gerenciar equipe |
| `admin` | 4 | Tudo + gerenciar usuários + configs |

### Mapeamento legado

| Legado | RBAC |
|--------|------|
| `tecnico` | `agente` |
| `gerente` | `supervisor` |
| `vendedor` | `agente` |
| `admin` | `admin` |

## Segurança da API

- **Rate Limiting**: 5 req/min (login), 10 req/min (sign), 20 req/min (refresh)
- **CORS**: Origens configuráveis via `CORS_ORIGINS`
- **Helmet**: Headers de segurança HTTP
- **CSRF**: Proteção em formulários
- **Validação**: Zod schemas em todos os inputs
- **SSRF**: Bloqueio de IPs privados em chamadas externas

## Dados Sensíveis

- **Senhas**: Nunca expostas em respostas API
- **Session tokens**: Nunca em logs ou erros
- **JWT secrets**: Gerados automaticamente em dev, obrigatórios em prod
- **API keys**: Criptografadas com AES-256-GCM em repouso

## Webhooks

- **Cloud API**: Validação HMAC-SHA256 (`X-Hub-Signature-256`)
- **Evolution API**: Validação de secret via query/header

## Banco de Dados

- **Soft delete**: Campo `active` (nunca DELETE físico)
- **Senhas**: bcrypt hash (nunca plain text)
- **RLS**: Não implementado (single-tenant)
- **Conexão**: SSL obrigatório em produção (`sslmode=require`)

## Variáveis Críticas

| Variável | Obrigatória em Produção |
|----------|------------------------|
| `DATABASE_URL` | ✅ |
| `DIRECT_URL` | ✅ (para migrations) |
| `JWT_SECRET` | ✅ |
| `JWT_REFRESH_SECRET` | ✅ |
| `INTEGRATION_ENCRYPTION_KEY` | Recomendado |
| `WHATSAPP_CLOUD_APP_SECRET` | Se usar Cloud API |

## Auditoria

- **Tabela**: `AuditLog` (imutável, sem UPDATE/DELETE)
- **Campos**: usuarioId, acao, entidade, entidadeId, ip, severity, clienteId, metadata
- **Cobertura**: Login, CRUD de tickets, alterações de config, permissões, billing, KB, CSAT, IA, feriados
- **Severidade**: alta (deletar, permissoes, encerrar_sem_resolucao), media (escalar, sla, config), baixa (criar, atualizar, mover_etapa)
- **ClienteId**: 53 call sites enriquecidos com vinculação ao cliente quando disponível
