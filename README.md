# 📜 Papyrus

API open-source para **geração de PDFs com templates personalizáveis**, construída com **Fastify** e **Puppeteer**. Ideal para aplicações educacionais, empresariais, médicas e documentos diversos.

---

## ✨ Funcionalidades

| Categoria        | Templates incluídos                                                |
| ---------------- | ------------------------------------------------------------------ |
| **Básicos**      | Página em branco • Logotipo • Marca-d’água • Moldura personalizada |
| **Educacionais** | Provas • Avaliações • Questionários simples e com moldura          |
| **Empresariais** | Orçamentos • Relatórios • Tabelas com somas automáticas            |
| **Médicos**      | Fichas de anamnese • Formulários clínicos personalizados           |

---

## 🔐 Autenticação via API Key

Todas as requisições exigem um header `x-api-key` com sua chave de acesso.

* Algumas chaves têm **limite de requisições por minuto**.
* Outras podem ser **premium** (com limites ampliados ou ilimitadas).

> Para solicitar sua chave ou configurar regras por chave, consulte o arquivo `.env` ou a administração do serviço.

---

## 🚀 Início Rápido

### 1. Clonar e instalar

```bash
git clone https://github.com/keverupp/papyrus.git
cd papyrus
npm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
# Edite o arquivo .env com:
# - DB_HOST, DB_USER, DB_PASS
# - API_KEYS=chave1,chave2,... (ou configurar via tabela)
# - RATE_LIMIT por chave (se ativado)
```

### 3. Criar banco e aplicar migrações

```bash
createdb papyrus
npm run migrate:latest
```

### 4. Rodar o servidor

```bash
npm run dev
```

* API: [http://localhost:3000](http://localhost:3000)
* Documentação Swagger: [http://localhost:3000/docs](http://localhost:3000/docs)

---

## 📚 Exemplo de uso da API

### Geração de PDF com marca d’água

```bash
http POST :3000/pdf \
  "x-api-key:MINHA_CHAVE" \
  type=basic title='Documento' \
  content='Conteúdo PDF' \
  watermark:='{"text":"CONFIDENCIAL","opacity":0.3}' \
  config:='{"pageSize":"A4","orientation":"portrait"}' \
  --download documento.pdf
```

### Geração de Orçamento

```bash
http POST :3000/pdf \
  "x-api-key:MINHA_CHAVE" \
  type=budget \
  title='Orçamento 2024' \
  budget:='{
    "company": "Minha Empresa",
    "client": { "name": "Cliente" },
    "items": [
      { "description": "Serviço A", "quantity": 1, "unitPrice": 2500 },
      { "description": "Serviço B", "quantity": 12, "unitPrice": 50 }
    ]
  }'
```

---

## ⚙️ Plugins & Stack Técnica

* **Fastify**

  * `@fastify/rate-limit` — controle de requisições por IP ou chave
  * `@fastify/static`, `@fastify/multipart` — uploads e assets
  * `@fastify/cors`, `@fastify/helmet`, `@fastify/compress`
* **Knex + PostgreSQL** — armazenamento opcional de logs ou templates
* **Puppeteer** — renderização headless de PDFs
* **fastify-guard** — pode ser adaptado para controle por API key
* **fastify-nodemailer** — envio de PDFs por e-mail

---

## 🗂️ Estrutura de Projeto

```
papyrus/
├─ src/
│  ├─ controllers/
│  ├─ plugins/             # Inclui API-key & rate-limit
│  ├─ services/            # Puppeteer e lógica de geração
│  ├─ templates/           # HTML/Handlebars
│  └─ utils/
├─ knexfile.js
├─ migrations/
├─ .env
└─ package.json
```

---

## 📈 Rate Limit e Controle de Chaves

| Chave         | Limite Padrão | Descrição                  |
| ------------- | ------------- | -------------------------- |
| `demo-key`    | 10 req/min    | Chave gratuita para testes |
| `premium-key` | 100 req/min   | Acesso elevado             |
| `unlimited`   | ilimitado     | Uso interno/admin          |

> As regras podem ser personalizadas no plugin `src/plugins/rate-limit.js`.

---

## 🛠️ Scripts

```bash
npm run dev                # Inicia servidor com Nodemon
npm run migrate:latest     # Executa migrações do banco
npm run migrate:rollback   # Reverte última migração
```

---

## 🤝 Contribuições

Pull requests são bem-vindos.
Antes de enviar, consulte o arquivo [CONTRIBUTING.md](CONTRIBUTING.md).

---

## 🏗️ Roadmap

* [ ] Templates pré-definidos
* [ ] Autenticação por API Key
* [ ] Limite por requisições
* [ ] Templates customizados via upload
* [ ] Webhooks (callback pós-geração)
* [ ] Dashboard Web
* [ ] CLI para uso local
* [ ] Logs analíticos por chave

---

## 📝 Licença

MIT — veja [LICENSE](LICENSE) para mais detalhes.

---

<p align="center">Feito com ❤️ por Cleverton e pela comunidade open-source.</p>
