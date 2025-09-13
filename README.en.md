# 📜 Papyrus API

[🇧🇷 Versão em Português](README.md) | [🇺🇸 English Version](README.en.md)

Open-source API for **PDF generation with customizable templates**, built with **Fastify** and **Typst**. Ideal for educational, business, healthcare, and general document applications.

---

## 🚀 Quick Start

### 📋 Prerequisites

* Node.js 16+
* External PostgreSQL
* MinIO (or S3-compatible storage)
* Redis
* NPM or Yarn

### ⚙️ Installation

```bash
git clone https://github.com/keverupp/papyrus-api.git
cd papyrus
npm install

# Set environment variables
cp .env.example .env
# Edit the .env file with your external PostgreSQL, MinIO and Redis credentials

# Run migrations (make sure the database already exists)
npm run migrate:latest

# Create sample API keys
npm run seed:run

# Start server
npm run dev
```

🌐 **API running at:** `http://localhost:4000`

To enable full debug logging, set `LOG_LEVEL=debug` in the `.env` file or as an environment variable before starting the server.

---

## 🔐 Authentication

All requests require the `x-api-key` header with a valid key:

```bash
curl -H "x-api-key: YOUR_API_KEY_HERE" http://localhost:4000/pdf/templates
```

### 🔑 API Key Types

| Type        | Limit       | Description               |
| ----------- | ----------- | ------------------------- |
| `basic`     | 10 req/min  | For basic use and testing |
| `premium`   | 100 req/min | For commercial use        |
| `unlimited` | Unlimited   | For administrators        |

---

## 📚 Available Endpoints

### 🏥 Health Check

**GET** `/health` - Check API status (no authentication required)

```bash
curl http://localhost:4000/health
```

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2025-06-23T19:43:05.747Z",
  "version": "1.0.0",
  "services": {
    "database": "connected",
    "pdf_engine": "ready",
    "templates": "loaded"
  }
}
```

---

### 📄 Templates

#### **GET** `/pdf/templates` - List all templates

```bash
curl -H "x-api-key: YOUR_KEY" http://localhost:4000/pdf/templates
```

#### **GET** `/pdf/templates/:type` - Get details of a specific template

```bash
curl -H "x-api-key: YOUR_KEY" http://localhost:4000/pdf/templates/budget-premium
```

---

### 🎨 PDF Generation

#### **POST** `/pdf` - Generate PDF

**Base structure:**

```json
{
  "type": "template_type",
  "title": "Document Title",
  "data": { /* template-specific data */ },
  "config": { /* optional PDF settings */ }
}
```

#### **POST** `/pdf/preview` - Preview HTML (for debugging)

```bash
curl -X POST http://localhost:4000/pdf/preview \
  -H "x-api-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type": "blank", "title": "Preview Test"}'
```

---

## 📋 Available Templates

### 📝 **Basic**

| Type        | Name           | Description                       |
| ----------- | -------------- | --------------------------------- |
| `blank`     | Blank Page     | Basic document with no formatting |
| `logo`      | With Logo      | Document with logo in the header  |
| `watermark` | With Watermark | Document with custom watermark    |

### 🎓 **Educational**

| Type         | Name       | Description                          |
| ------------ | ---------- | ------------------------------------ |
| `exam`       | Exam       | Template for school tests            |
| `assessment` | Assessment | Template for evaluations and quizzes |
| `quiz`       | Quiz       | Template for simple quizzes          |

### 💼 **Business**

| Type             | Name           | Description                             |
| ---------------- | -------------- | --------------------------------------- |
| `budget`         | Budget         | Basic budget template                   |
| `budget-premium` | Premium Budget | Advanced budget with logo and watermark |
| `report`         | Report         | Executive report template               |
| `invoice`        | Invoice        | Invoice and billing document            |

### 🏥 **Healthcare**

| Type            | Name           | Description                   |
| --------------- | -------------- | ----------------------------- |
| `anamnesis`     | Anamnesis Form | Medical record form           |
| `prescription`  | Prescription   | Medical prescription template |
| `clinical_form` | Clinical Form  | General clinical form         |

---

## 💰 Practical Examples - Premium Budget

### 🎯 **Example 1: Basic Budget**

(Example request remains the same, just adapted in description)

---

## 📝 Other Templates

### 📄 **Basic Document**

(Example: blank document with text)

### 🎓 **School Exam**

(Example: exam document with questions and metadata)

---

## ⚙️ PDF Configurations

### 📐 **Config Options**

```json
{
  "config": {
    "format": "A4",
    "orientation": "portrait",
    "margin": {
      "top": "2cm",
      "right": "1.5cm",
      "bottom": "2cm", 
      "left": "1.5cm"
    }
  }
}
```

---

## 🔑 API Key Management

(Endpoints: get current key, list types, create new key)

---

## 📊 Statistics

Get usage stats for your API key

---

## 🚨 Error Codes

| Code  | Description                |
| ----- | -------------------------- |
| `401` | Invalid or missing API key |
| `429` | Too many requests          |
| `400` | Invalid request data       |
| `404` | Template not found         |
| `500` | Internal server error      |

---

## 🛠️ Available Scripts

```bash
npm run dev               # Start in development
npm run start             # Start in production
npm run migrate:latest    # Apply migrations
npm run migrate:rollback  # Rollback migration
npm run seed:run          # Run seeds (create sample keys)
```

---

## 📈 Roadmap

* [x] Basic template system
* [x] API key authentication
* [x] Rate limiting by key type
* [x] Premium templates with branding
* [ ] Web dashboard for management
* [ ] Webhooks for notifications
* [ ] Uploadable custom templates
* [ ] PDF digital signature
* [ ] CLI for local usage

---

## 🤝 Contributing

1. Fork the project
2. Create a branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -m 'Add new feature'`
4. Push: `git push origin feature/new-feature`
5. Open a Pull Request

---

## 📝 License

MIT License – see [LICENSE](LICENSE) for more details.

---

## 🆘 Support

* 📧 **Email:** [clevertonruppenthal1@gmail.com](mailto:clevertonruppenthal1@gmail.com)
* 🐛 **Issues:** [GitHub Issues](https://github.com/keverupp/papyrus-api/issues)

---

<p align="center">
  <strong>Made with ❤️ by the Papyrus team</strong><br>
  <em>Turning data into professional documents</em>
</p>
