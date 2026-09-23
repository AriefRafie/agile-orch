# AutoSprint: AI-Powered Agile Task Orchestrator
<p>
  AutoSprint is an intelligent project management tool that bridges the gap between raw task ideation and structured execution. By leveraging LLMs, it automatically analyzes task titles 
  and descriptions to assign priorities, estimate effort, categorize technical debt, detect risks, and suggest subtasks — allowing developers to focus on coding rather than project overhead.
</p>

## Features
+ **AI Task Analysis**: Automatically calculates priority (1-5), estimated hours, risk flags, and confidence scores using LLMs.

+ **Multi-Provider AI**: Supports Ollama (local), OpenAI, and Groq API — configurable via `.env`.

+ **Sprint Engine**: Create sprints with velocity-based capacity, auto-assign tasks, and track progress with burndown charts.

+ **Kanban Board**: Drag-and-drop task management across Todo → In Progress → Review → Done.

+ **Dynamic Execution Plan**: Visualizes remaining effort and prioritizes "Critical Path" items.

+ **Smart Categorization**: Segregates tasks into Backend, Frontend, Security, DevOps, Database, and Documentation.

+ **AI Insights Panel**: Per-task confidence scoring, priority rationale, risk flags, and suggested subtasks.

+ **Multi-User Collaboration**: Admin, Developer, and Viewer roles with task assignment and activity logging.

+ **Real-time Notifications**: SSE-powered notifications for task assignments, status changes, and sprint deadlines.

+ **PDF Reports**: Export sprint summaries as professional PDF documents.

## Prerequisites
+ Docker & Docker Compose installed.

+ Ollama installed (if running outside the container) or enough RAM (8GB+) to run it inside.

+ Minimum 10GB free disk space for Docker images and LLM weights.

## Quick Start

### 1. Configure Environment Variables

Create environment configuration files using the provided .env.example structure. These variables allow the backend, database, and frontend to communicate correctly during development.
You must create two .env files:

Create a file named `.env` in the root directory and add the following variables:
```
POSTGRES_USER=admin
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_DB=autosprint
DATABASE_URL=postgresql://admin:your_secure_password_here@db:5432/autosprint
SECRET_KEY=your_long_random_secret_here
ADMIN_PASSWORD=your_secure_admin_password_here
CORS_ORIGIN=http://localhost:3009
OLLAMA_URL=http://host.docker.internal:11434/api/generate
OLLAMA_MODEL=llama3.1:8b
AI_PROVIDER=ollama
OPENAI_API_KEY=
GROQ_API_KEY=
```

Create a `.env` file inside the frontend directory and include:
```
VITE_API_URL=http://localhost:8009
```

### 2. Launch Services
Run the following command to build and start all containers:

```
docker-compose up --build
```

### 3. Initialize the AI Model
By default the backend talks to an Ollama running on your machine (native Ollama uses the GPU; the Docker image is CPU-only on macOS). Install Ollama, then pull the model:

```
ollama pull llama3.1:8b
```

`llama3.1:8b` is the recommended model: on the app's task-analysis prompt it classified 14/14 categories and 13-14/14 priorities correctly. `llama3.2` (3B) is a lighter fallback but mislabels some security tasks.

To run Ollama inside Docker instead, set `OLLAMA_URL=http://ollama:11434/api/generate` in `.env` and start with:

```
docker compose --profile docker-ollama up --build
docker exec -it as-ollama ollama pull llama3.1:8b
```

### 4. Access the Application
- **Frontend**: http://localhost:3009
- **Backend API**: http://localhost:8009
- **Default Admin**: username `admin`, password set via `ADMIN_PASSWORD` env var

## AI Provider Configuration

AutoSprint supports three AI providers. Set `AI_PROVIDER` in your `.env`:

| Provider | `AI_PROVIDER` | Required Keys | Notes |
|----------|--------------|---------------|-------|
| Ollama (default) | `ollama` | None | Runs on the host by default; Docker via `--profile docker-ollama` |
| OpenAI | `openai` | `OPENAI_API_KEY` | Uses gpt-4o-mini by default |
| Groq | `groq` | `GROQ_API_KEY` | Uses llama-3.1-8b-instant by default |
