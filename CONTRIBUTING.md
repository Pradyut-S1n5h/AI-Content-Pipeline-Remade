# Contributing to SceneCraft

Thank you for your interest in contributing to **SceneCraft**! We welcome community contributions, bug fixes, and feature enhancements.

---

## Getting Started

### 1. Prerequisites
- **Node.js**: v20 or higher (v22 recommended)
- **npm**: v10 or higher
- **Gemini API Key**: (Optional for local testing; demo mode is functional without it)

### 2. Setup
1. Fork and clone the repository:
   ```bash
   git clone https://github.com/Pradyut-S1n5h/AI-Content-Pipeline-Re-coded.git
   cd AI-Content-Pipeline-Re-coded
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy environment configuration:
   ```bash
   cp .env.example .env
   ```
4. (Optional) Add your Gemini API key to `.env`:
   ```env
   GEMINI_API_KEY="your-gemini-api-key-here"
   ```

### 3. Running Development Server
Start the full-stack server (Express backend + Vite frontend):
```bash
npm run dev
```
Open your browser at `http://localhost:3000`.

---

## Development Workflow

### Creating a Branch
Create a descriptive branch for your work:
```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-description
```

### Running Tests & Linting
Before submitting your changes, ensure all tests and type checks pass:
```bash
# Run unit tests
npm test

# Run TypeScript linter
npm run lint

# Verify production build
npm run build
```

---

## Architecture Principles

1. **Security First**: Never expose API keys to client-side bundles. All Gemini SDK calls must remain inside `server.ts`.
2. **Anti-Slop Design**: Follow the strict design constitution: zero pill capsule enclosures for static metadata, natural title-case prose, clear visual hierarchy, accessible contrast.
3. **No Fake Features**: If an external API or service is required, either provide a real implementation or clearly document the limitation with a graceful fallback.
4. **Structured Output**: Use JSON Schemas for AI generation rather than regex parsing of free-form text.

---

## Submitting a Pull Request

1. Ensure all tests pass (`npm test` and `npm run lint`).
2. Commit your changes using concise, descriptive commit messages:
   ```bash
   git commit -m "feat(scenes): add batch renumbering on scene drag"
   ```
3. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
4. Open a Pull Request against `main` on GitHub with:
   - Clear description of what changed
   - Steps to test the change
   - Any relevant screenshots
