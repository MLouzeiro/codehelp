# API Pública de Integração (`/api/integration`)

Permite que sistemas externos (CRM, ERPs, ferramentas de BI) consultem e atualizem dados do CodeHelp usando uma **API Key** — sem depender de sessão de usuário.

> ⚠️ Diferente das rotas internas (que usam JWT + CSRF), esta API usa **autenticação por API Key** e **nunca** expõe senhas, tokens de sessão ou dados sensíveis de usuários.

---

## Autenticação

Chave de API configurada no backend via variável de ambiente:

```
INTEGRATION_API_KEYS=clave-xxxx-1,clave-xxxx-2
```

- Chaves separadas por vírgula.
- Chave com sufixo `:rw` possui **escopo de leitura e escrita** (ex.: `chave-prod-rw`).
- Chave sem sufixo tem **apenas leitura**.

Envio da chave (header `x-api-key` ou query `api_key`):

```http
GET /api/integration/customers
x-api-key: chave-prod-rw
```

### Erros de autenticação

| HTTP | Código            | Significado                                   |
|------|-------------------|-----------------------------------------------|
| 401  | `chave_invalida`  | Chave ausente ou inexistente.                 |
| 403  | `sem_permissao_escrita` | Operação de escrita com chave somente-leitura. |

### Rate limit

- **120 requisições/minuto** por IP. Excedeu → `429 Too Many Requests`.

---

## Endpoints

Base URL: `https://<SEU_HOST>/api/integration`

### GET `/customers`

Lista clientes com paginação e filtros opcionais.

| Parâmetro | Tipo    | Descrição                                    |
|-----------|---------|----------------------------------------------|
| `page`    | int     | Página (início em 1). Padrão `1`.            |
| `limit`   | int     | Itens por página (máx. 100). Padrão `20`.    |
| `term`    | string  | Busca por nome/razão social (contém, case-insensitive). |
| `active`  | bool    | Filtra por `ativo` (true/false).             |

**Resposta 200** (`application/json`):

```json
{
  "data": [
    {
      "id": "uuid",
      "razaoSocial": "Codemed Telecom",
      "nomeFantasia": "Codemed",
      "cnpj": "00.000.000/0001-00",
      "email": "contato@codemed.com",
      "telefone": "(85) 99999-0000",
      "ativo": true,
      "createdAt": "2026-08-01T10:00:00.000Z"
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 1
}
```

---

### GET `/customers/:id`

Detalha um cliente (inclui contatos e endereço quando houver).

**Resposta 200**:

```json
{
  "id": "uuid",
  "razaoSocial": "Codemed Telecom",
  "nomeFantasia": "Codemed",
  "cnpj": "00.000.000/0001-00",
  "email": "contato@codemed.com",
  "telefone": "(85) 99999-0000",
  "contato": { "nome": "João", "telefone": "(85) 98888-0000" },
  "endereco": { "cidade": "Fortaleza", "uf": "CE" },
  "ativo": true
}
```

`404` se o cliente não existir.

---

### PATCH `/customers/:id`  *(requer chave `:rw`)*

Atualiza dados do cliente.

```json
{ "email": "novo@codemed.com", "telefone": "(85) 97777-0000" }
```

**Resposta 200**: cliente atualizado (mesmo shape do GET).

**Resposta 400**: campos inválidos (ex.: `cnpj` duplicado, e-mail malformado).

---

### GET `/companies`

Lista empresas cadastradas.

| Parâmetro | Tipo   | Descrição                                   |
|-----------|--------|---------------------------------------------|
| `page`    | int    | Página. Padrão `1`.                         |
| `limit`   | int    | Máx. 100. Padrão `20`.                     |

**Resposta 200**:

```json
{ "data": [ { "id": "uuid", "nome": "Matriz", "cnpj": "..." } ], "page": 1, "limit": 20, "total": 1 }
```

---

### GET `/contracts`

Lista contratos/serviços.

| Parâmetro | Tipo   | Descrição                                   |
|-----------|--------|---------------------------------------------|
| `page`    | int    | Página. Padrão `1`.                         |
| `limit`   | int    | Máx. 100. Padrão `20`.                     |

**Resposta 200**:

```json
{ "data": [ { "id": "uuid", "clienteId": "uuid", "descricao": "Serviço de link dedicado", "status": "ativo" } ], "page": 1, "limit": 20, "total": 1 }
```

---

### GET `/tickets`

Lista tickets com filtros opcionais.

| Parâmetro  | Tipo    | Descrição                                       |
|------------|---------|-------------------------------------------------|
| `page`     | int     | Página. Padrão `1`.                             |
| `limit`    | int     | Máx. 100. Padrão `20`.                          |
| `status`   | string  | `aberto`, `em_atendimento`, `pendente`, `fechado`, etc. |
| `etapa`    | string  | Etapa do pipeline (ex.: `em_atendimento`).      |
| `clienteId`| uuid    | Filtra por cliente.                             |
| `canal`    | string  | `whatsapp_baileys`, `whatsapp_evolution`, `email`, etc. |
| `prioridade` | string | `baixa`, `media`, `alta`, `critica`.          |

**Resposta 200**:

```json
{
  "data": [
    {
      "id": "uuid",
      "protocolo": "TKT-000123",
      "externalId": "wa-9e6e...",
      "clientId": "uuid",
      "contactName": "Maria",
      "contactPhone": "85999990000",
      "canal": "whatsapp_baileys",
      "status": "aberto",
      "etapa": "em_atendimento",
      "prioridade": "media",
      "categoria": null,
      "assunto": null,
      "dataAbertura": "2026-08-19T10:00:00.000Z",
      "createdAt": "2026-08-19T10:00:00.000Z"
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 1
}
```

---

### GET `/tickets/:id`

Detalha um ticket incluindo mensagens da conversa e cliente.

**Resposta 200**:

```json
{
  "id": "uuid",
  "protocolo": "TKT-000123",
  "externalId": "wa-9e6e...",
  "client": { "id": "uuid", "razaoSocial": "Codemed Telecom" },
  "contactName": "Maria",
  "contactPhone": "85999990000",
  "canal": "whatsapp_baileys",
  "status": "aberto",
  "etapa": "em_atendimento",
  "prioridade": "media",
  "dataAbertura": "2026-08-19T10:00:00.000Z",
  "messages": [
    {
      "id": "uuid",
      "fromMe": false,
      "content": "Bom dia, preciso de suporte",
      "sentAt": "2026-08-19T10:01:00.000Z",
      "source": "whatsapp"
    }
  ]
}
```

---

### GET `/agents`

Lista analistas/agentes ativos (usuários com role de atendimento). **Nunca** retorna senha ou token de sessão.

| Parâmetro | Tipo   | Descrição |
|-----------|--------|-----------|
| `page`    | int    | Página. Padrão `1`. |
| `limit`   | int    | Máx. 100. Padrão `20`. |

**Resposta 200**:

```json
{
  "data": [ { "id": "uuid", "name": "Ana", "email": "ana@codemed.com", "role": "vendedor", "active": true, "online": false, "lastSeenAt": null } ],
  "page": 1,
  "limit": 20,
  "total": 1
}
```

---

### PATCH `/tickets/:id/status`  *(requer chave `:rw`)*

Atualiza status/etapa de um ticket (útil para sincronizar com CRM externo).

```json
{
  "status": "fechado",
  "etapa": "concluido",
  "motivoStatus": "resolvido_pelo_cliente"
}
```

| Campo           | Tipo   | Obrigatório | Descrição                                  |
|-----------------|--------|-------------|--------------------------------------------|
| `status`        | string | sim         | Novo status (`aberto`, `fechado`, etc.).   |
| `etapa`         | string | não         | Etapa do pipeline (valida etapas fixas).   |
| `motivoStatus`  | string | não         | Motivo do encerramento.                    |
| `dataFechamento`| string | não         | Data de encerramento (ISO).                |

**Resposta 200**:

```json
{ "id": "uuid", "protocolo": "TKT-000123", "status": "fechado", "etapa": "concluido", "motivoStatus": "resolvido_pelo_cliente", "dataFechamento": "2026-08-20T18:00:00.000Z", "updatedAt": "2026-08-20T18:00:00.000Z" }
```

**Resposta 400**: etapa inválida / status inválido.
**Resposta 404**: ticket não encontrado.

> ⚠️ **Importante**: alterar status/etapa de um ticket **não** dispara envio de mensagens WhatsApp. Para encerrar com envio de confirmação/CSAT, use o fluxo interno do Helpdesk.

---

## Erros (formato geral)

```json
{ "error": "mensagem de erro" }
```

| HTTP | Significado                                          |
|------|------------------------------------------------------|
| 400  | Parâmetros/corpo inválidos.                          |
| 401  | API key ausente ou inválida.                         |
| 403  | Escopo de escrita não permitido para esta chave.     |
| 404  | Recurso não encontrado.                              |
| 429  | Rate limit excedido (120 req/min).                   |
| 500  | Erro interno do servidor.                            |

---

## Boas práticas

1. **Guarde a API Key com segurança** — quem possui a chave tem acesso a dados de clientes e (se `:rw`) pode alterar tickets.
2. **Use somente leitura** para integrações de BI/reporting.
3. **Trate `429`** com backoff exponencial.
4. **Nunca** envie a chave em URLs de logs; prefira o header `x-api-key`.