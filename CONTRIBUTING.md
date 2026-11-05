# Contributing to SceneCraft

Thank you for your interest in contributing to **SceneCraft**! We welcome community contributions, bug fixes, and feature enhancements.

---

## Getting Started

### 1. Prerequisites
- **Node.js**: v20 or higher (v22 recommended)
- **npm**: v10 or higher
- **Ollama** for local text inference
- **Python 3.11** for the local Diffusers media runtime (supported GPU hardware needed for video)

### 2. Setup
1. Fork and clone the repository:
   ```bash
   git clone https://github.com/Pradyut-S1n5h/AI-Content-Pipeline-Remade.git
   cd AI-Content-Pipeline-Remade
   ```
2. Install dependencies:
   ```bash
   npm ci
   ```
3. Configure the local media runtime (optional for frontend-only work):
   ```bash
   npm run setup:local-ai
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

1. **Local inference only**: Keep generation on the configured loopback runtimes. Do not add hosted AI APIs, credentials, or remote inference fallbacks.
2. **Anti-Slop Design**: Follow the strict design constitution: zero pill capsule enclosures for static metadata, natural title-case prose, clear visual hierarchy, accessible contrast.
3. **No Fake Features**: Report missing models, unsupported hardware, and inference errors instead of simulating generated output.
4. **Structured Output**: Validate local model output before updating project content.

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
