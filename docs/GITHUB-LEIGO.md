# Como Usar o GitHub — Guia para Leigos

## O que é o GitHub?

O GitHub é um serviço online que salva cópias do seu projeto na nuvem. Assim você:
- Não perde seu trabalho se o computador quebrar
- Pode acessar de qualquer lugar
- Pode voltar versões anteriores
- Pode trabalhar em equipe

## Passo 1: Instalar o Git

O Git é o programa que controla as versões.

**Windows:**
1. Acesse https://git-scm.com/download/win
2. Baixe e instale (aceite todos os padrões)

**Para verificar se instalou:**
```bash
git --version
```

## Passo 2: Configurar seu usuário

```bash
git config --global user.name "Seu Nome"
git config --global user.email "seu@email.com"
```

## Passo 3: Criar conta no GitHub

1. Acesse https://github.com
2. Clique "Sign up"
3. Crie uma conta gratuita

## Passo 4: Criar um repositório

1. No GitHub, clique o botão "+" no canto superior direito
2. Clique "New repository"
3. Nome: `code-help`
4. Marque "Add a README file"
5. Clique "Create repository"

## Passo 5: Conectar seu projeto ao GitHub

Na pasta do projeto, abra o terminal e digite:

```bash
# Iniciar o Git no projeto
git init

# Conectar ao GitHub (substitua SEU-USUARIO)
git remote add origin https://github.com/SEU-USUARIO/code-help.git

# Primeiro commit (salvar)
git add .
git commit -m "Primeira versão do sistema"

# Enviar para o GitHub
git push -u origin main
```

## Passo 6: Salvar alterações (commit)

Sempre que fizer uma alteração importante:

```bash
# 1. Ver o que mudou
git status

# 2. Adicionar tudo
git add .

# 3. Salvar com descrição
git commit -m "Adicionei a funcionalidade X"

# 4. Enviar para o GitHub
git push
```

## Passo 7: Criar uma versão (tag)

Quando o sistema estiver funcionando bem:

```bash
# Criar versão v1.0.0
git tag -a v1.0.0 -m "Versão estável inicial"

# Enviar versão para o GitHub
git push origin v1.0.0
```

## Passo 8: Voltar para uma versão anterior

Se algo quebrar:

```bash
# Ver todas as versões
git log --oneline

# Voltar para uma versão
git checkout v1.0.0

# Voltar para o desenvolvimento
git checkout main
```

## Glossário

| Termo | Significado |
|-------|-------------|
| **commit** | Salvar uma alteração (como um "ponto de salvamento") |
| **push** | Enviar do seu computador para o GitHub |
| **pull** | Baixar do GitHub para o seu computador |
| **branch** | Uma linha de desenvolvimento separada |
| **merge** | Juntar duas branches |
| **tag** | Uma versão marcada (v1.0.0, v1.1.0, etc) |
| **clone** | Baixar um projeto do GitHub |
| **repository** | O projeto completo no GitHub |
| **rollback** | Voltar para uma versão anterior |

## Estrutura de Branches

```
main          → Versão estável (produção)
develop       → Desenvolvimento e testes
feature/xxx   → Nova funcionalidade
fix/xxx       → Correção de bug
hotfix/xxx    → Correção urgente da produção
```

## Exemplos Práticos

### Criar uma nova funcionalidade
```bash
git checkout -b feature/nova-tela
# ... faz as alterações ...
git add .
git commit -m "feature: nova tela de relatórios"
git push -u origin feature/nova-tela
# No GitHub, criar "Pull Request" para juntar ao develop
```

### Corrigir um bug
```bash
git checkout -b fix/bug-login
# ... corrige o bug ...
git add .
git commit -m "fix: correção do erro de login"
git push -u origin fix/bug-login
```

### Correção urgente na produção
```bash
git checkout main
git checkout -b hotfix/bug-critico
# ... corrige ...
git add .
git commit -m "hotfix: correção de bug crítico no login"
git push -u origin hotfix/bug-critico
# Juntar ao main E develop
```
