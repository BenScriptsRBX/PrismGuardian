# PrismGuard

PrismGuard is an advanced moderation and verification bot designed for Fluxer and other platforms. It uses AI to help manage communities, automate verification, and enforce rules efficiently.  

---

## Features

- AI-powered moderation and spam detection    
- Flexible configuration with environment variables  
- PostgreSQL database support   

---

## Requirements

- Node.js v18+  
- PostgreSQL database  
- A Fluxer token  
- Groq API key  

---

## Installation

1. **Clone the repository**  

```
git clone https://github.com/BenScriptsRBX/PrismGuardian.git
cd prismguard
```

2. **Install dependencies**  

```
npm install
```

3. **Setup environment variables**  

Create a `.env` file in the project root:

```
FLUXER_TOKEN=your_fluxer_token_here
DATABASE_URL=your_postgres_database_url_here
GROQ_API_KEY=your_groq_api_key_here
```

> **Note:** Replace the placeholders with your actual credentials. Keep this file private. Do **not** commit it to GitHub.  

---

## Running PrismGuard

Start the bot:

```
npm start
```

Or for development (auto-restarts on changes):

```
npm run dev
```

---

## Configuration

- **FLUXER_TOKEN** – Token for your Fluxer account.  
- **DATABASE_URL** – Connection string for your PostgreSQL database.  
- **GROQ_API_KEY** – API key for Groq AI integration.  

Optional configuration variables are available in the `.env.example` file.  

---

## Contributing

1. Fork the repository  
2. Create a feature branch  
3. Submit a pull request  
4. Make sure your changes follow the [Contributor License Agreement](CONTRIBUTOR_LICENSE_AGREEMENT.md)  

---

## License

PrismGuard is licensed under the [MIT License](LICENSE). See LICENSE for more details.  

---

## Disclaimer

PrismGuard is provided "as-is" without warranty. See [DISCLAIMER.md](DISCLAIMER.md) for details.
