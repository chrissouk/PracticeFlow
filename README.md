# PracticeFlow

![PracticeFlow Screenshot](Progress/Screenshot%202025-10-31%20at%2014.08.14.png)

## Introduction

Coaches spend a large portion of their time creating, editing, and reusing practice plans — work that pulls them away from time with athletes, technique coaching, and individual feedback. This project accelerates the practice-planning workflow by converting historical practice materials (PDFs and CSVs) into vectorized documents and using a retrieval-augmented generation (RAG) pipeline to surface and generate practice content.

The emphasis is on helping coaches find, reuse, and adapt existing sets, drills, and session structures quickly so they can spend more time coaching and less time formatting practice plans.

## What this solves

- Reduces manual effort required to assemble practice sessions from past plans and PDFs.
- Enables fast retrieval of similar practices or reusable sets/drills via vector search (FAISS).
- Provides a drafting assistant (RAG) that can suggest practice text backed by retrieved context.

## Scope and limitations

- This tool is an assistant for planning; it does not replace a coach's domain expertise or in-session decision-making.
- Outputs should be reviewed and adjusted for athlete safety, training periodization, and context.

## High-level architecture

- Data ingestion: PDFs and CSVs in `Data/Raw/` and `Data/Training/` are converted to text documents (see `create_training_data.py`).
- Embeddings: documents are embedded using the project's embedding model and stored in a FAISS index (`Models/.../vector_index/`).
- Retrieval + Generation: a top-k retrieval from FAISS provides context; a local HF model (under `Models/llama_3_model/`) generates a response conditioned on that context (RAG).

## Quick start (macOS / zsh)

1. Create and activate a Python virtual environment

```bash
python3 -m venv .venv
source .venv/bin/activate
```

2. Install Python dependencies

```bash
pip install -r requirements.txt
```

3. Create a `.env` file in the project root with your Hugging Face token

```bash
# .env
HF_KEY=your_huggingface_token_here
```

4. Generate training PDFs from the CSV training dataset (used to create documents for embedding)

```bash
python create_training_data.py
```

5. Run the model from the CLI (example)

```bash
python run_model.py "PRACTICETITLE Sprint"
```

## Environment & hardware notes

- The Python pipeline uses PyTorch and attempts to use `metal` on macOS when available; otherwise it runs on CPU.
- `run_model.py` logs into Hugging Face using `HF_KEY` (stored in `.env`) so ensure that value is set before running.

## Data & models (paths)

- Source PDFs: `Data/Raw/CommitSwimming/`, `Data/Raw/TeamUnify/`.
- Training CSVs: `Data/Training/practiceInfo.csv`, `setInfo.csv`, `exerciseInfo.csv`.
- Generated PDFs used for embedding: `Data/Training/PDFS/practice_*.pdf`.
- Models and indexes: `Models/llama_3_model/` (contains `llm_pipeline`, `llm_model`, `llm_tokenizer`, `vector_index/index.faiss`, etc.).

## Project layout (important files)

- `create_training_data.py` — converts training CSVs into plain-text PDFs stored in `Data/Training/PDFS/`.
- `run_model.py` — primary Python runner: loads model/tokenizer, embedding model, FAISS index, and generates responses.
- `rag.py`, `save_model.py` — helper scripts for building the RAG pipeline and saving artifacts.
- `server.js`: small Node/Express server that exposes the AI backend via a `/generate-practice` endpoint. The server spawns `run_model.py` as a subprocess and is the primary way to access the AI from a web client or UI.
- `requirements.txt` — Python dependencies.
- `package.json` — Node dependencies for the optional server and parsing utilities.

## Node server and JavaScript notes

`server.js` is a lightweight server that uses `express`, `cors`, and `pdf-parse` to provide the web API for the AI backend. It spawns the Python process and returns the generated practice text. Running the server is required if you want to access the AI from a browser or other web client.

Several JavaScript files in the repo are parsing utilities or legacy AI code. The active ML/embedding/inference work is Python-first; the JS files are kept for parsing and the web API.

To run the Node server

```bash
# Install Node dependencies and start the server (this is required to access the AI backend from the web UI)
npm install
node server.js
```

## Usage tips and troubleshooting

- Memory: embedding large document sets can be memory intensive. Reduce batch sizes in the embedding step or run on a machine with more RAM if you hit OOM errors.
- Missing model files: ensure `Models/llama_3_model/` and its subfolders exist. `run_model.py` expects a `llm_pipeline` and an `embedding_model.pkl` inside that directory.
- HF auth: if HF login fails, check `HF_KEY` in `.env` and that your token has the required scopes.

## Examples

- Quick CLI example

```bash
python run_model.py "PRACTICETITLE Sprint"
# Expected output: logs containing 'Context:' and a generated 'Response:' string printed or logged.
```

- Using the Node server (example client request)

```json
POST /generate-practice
{
	"question": "Make me a 60 minute sprint-focused practice"
}

# Response JSON: { "success": true, "practice": "...generated text..." }
```

## Development notes

- Keep the Python ML path as the canonical source for embedding, retrieval, and generation.
- JavaScript files are useful for parsing workflows and the demo web server, but JS-based AI code in the repo is deprecated.

## Contributing

- Add or update scripts and include usage examples in this README.
- Run the existing Python checks and basic smoke tests after changes.

## License

- (Add license / copyright info here)
