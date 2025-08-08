# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package Management

**IMPORTANT**: Always use `uv` for all Python package management - never use `pip` directly.

```bash
# Install dependencies
uv sync

# Add new packages
uv add <package_name>

# Run Python scripts
uv run python <script.py>
```

## Development Commands

### Starting the Application
```bash
# Quick start (recommended)
chmod +x run.sh
./run.sh

# Manual start with uv
cd backend && uv run uvicorn app:app --reload --port 8000
```

### Environment Setup
Create `.env` file in root directory:
```
ANTHROPIC_API_KEY=your_api_key_here
```

### Access Points
- Web Interface: http://localhost:8000
- API Documentation: http://localhost:8000/docs

## Architecture Overview

This is a **tool-based RAG system** for querying course materials, built with a modular architecture that emphasizes intelligent retrieval over simple similarity search.

### Core Pattern: Tool-Based RAG
Unlike traditional RAG systems that always perform similarity search, this system uses Claude's tool-calling capability to intelligently decide when and how to search. The AI can:
- Use general knowledge for broad questions
- Invoke search tools for course-specific queries
- Apply filters (course name, lesson number) based on context

### Key Architectural Components

**RAG System Orchestrator** (`backend/rag_system.py`):
- Central coordinator managing the entire pipeline
- Integrates document processing, vector storage, AI generation, and session management
- Registers search tools with `ToolManager` for AI to use

**AI Generator with Tools** (`backend/ai_generator.py`):
- Manages Anthropic Claude API interactions
- Implements tool execution flow: initial response → tool calls → final synthesis
- System prompt emphasizes brevity and direct answers

**Search Tools** (`backend/search_tools.py`):
- Implements `Tool` abstract base class for extensibility
- `CourseSearchTool`: Semantic search with course/lesson filtering
- Tracks sources for UI display via `last_sources` attribute

**Vector Store** (`backend/vector_store.py`):
- ChromaDB wrapper with sentence transformers for embeddings
- Dual collections: course metadata and content chunks
- `SearchResults` dataclass for structured query results

**Document Processor** (`backend/document_processor.py`):
- Parses structured course documents (Title, Link, Instructor, Lessons)
- Sentence-based chunking with configurable size (800 chars) and overlap (100 chars)
- Context injection: prepends course/lesson info to chunks for better retrieval

### Data Models (`backend/models.py`)
- `Course`: Contains title, link, instructor, lessons list
- `Lesson`: lesson_number, title, optional link
- `CourseChunk`: Content chunk with metadata for vector storage

### Request Flow
1. Frontend POST to `/api/query` with query and session_id
2. FastAPI endpoint delegates to `rag_system.query()`
3. RAG system adds context and calls AI generator with tools
4. Claude analyzes and optionally invokes search tool
5. Search tool queries ChromaDB and formats results
6. Claude synthesizes final response from search results
7. Session manager updates conversation history
8. Response returned with answer and sources

### Key Design Decisions

**Tool-Based Architecture**: AI autonomously decides search strategy rather than always retrieving fixed N results. Enables more sophisticated query handling.

**Session Management**: Maintains conversation context across queries (max 2 exchanges by default).

**Source Transparency**: UI displays which courses/lessons informed each answer via collapsible sources section.

**Modular Components**: Clear separation between document processing, vector storage, AI generation, and search tools. Each component has single responsibility.

**Sentence-Based Chunking**: Preserves semantic boundaries while maintaining context through overlap and metadata injection.

## Document Processing Pipeline

Course documents in `docs/` folder are automatically loaded on startup with this structure:
```
Course Title: [title]
Course Link: [url]
Course Instructor: [name]

Lesson 0: Introduction
Lesson Link: [url]
[lesson content...]

Lesson 1: [title]
[lesson content...]
```

Processing stages:
1. Metadata extraction from header lines
2. Lesson identification and grouping
3. Text chunking with overlap
4. Context injection (course/lesson info)
5. Vector embedding and storage in ChromaDB

## Frontend Architecture

Single-page application (`frontend/`) with vanilla JavaScript:
- Markdown rendering for AI responses
- Session management for conversation continuity
- Loading states and error handling
- Collapsible sources display
- Auto-loads course statistics on startup