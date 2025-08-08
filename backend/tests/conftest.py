import pytest
from unittest.mock import Mock, MagicMock, patch
from typing import Dict, Any, List
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Shared test data
@pytest.fixture
def sample_query_request():
    """Sample query request data"""
    return {
        "query": "Tell me about machine learning",
        "session_id": "test_session_123"
    }

@pytest.fixture
def sample_courses():
    """Sample course data for testing"""
    return [
        {
            "title": "Introduction to Machine Learning",
            "link": "https://example.com/ml",
            "instructor": "John Doe",
            "lessons": [
                {"lesson_number": 0, "title": "Introduction", "link": "https://example.com/ml/lesson0"},
                {"lesson_number": 1, "title": "Supervised Learning", "link": None},
                {"lesson_number": 2, "title": "Unsupervised Learning", "link": None}
            ]
        },
        {
            "title": "Advanced Python Programming",
            "link": "https://example.com/python",
            "instructor": "Jane Smith",
            "lessons": [
                {"lesson_number": 0, "title": "Python Basics", "link": None},
                {"lesson_number": 1, "title": "Object-Oriented Programming", "link": None}
            ]
        }
    ]

@pytest.fixture
def mock_rag_system():
    """Mock RAG system for testing API endpoints"""
    mock = MagicMock()
    
    # Mock query method
    mock.query.return_value = (
        "Machine learning is a subset of artificial intelligence that enables systems to learn from data.",
        ["Introduction to Machine Learning - Lesson 1", "Advanced Topics in ML - Lesson 3"]
    )
    
    # Mock get_course_analytics method
    mock.get_course_analytics.return_value = {
        "total_courses": 5,
        "course_titles": [
            "Introduction to Machine Learning",
            "Advanced Python Programming",
            "Data Structures and Algorithms",
            "Web Development Fundamentals",
            "Database Design"
        ]
    }
    
    # Mock session_manager
    mock.session_manager.create_session.return_value = "new_session_456"
    
    return mock

@pytest.fixture
def mock_vector_store():
    """Mock vector store for testing"""
    from unittest.mock import MagicMock
    
    mock = MagicMock()
    mock.search.return_value = MagicMock(
        chunks=[
            MagicMock(
                content="Machine learning content",
                metadata={
                    "course_title": "Introduction to Machine Learning",
                    "lesson_number": 1,
                    "lesson_title": "Supervised Learning"
                }
            )
        ],
        scores=[0.95]
    )
    mock.list_courses.return_value = ["Introduction to Machine Learning", "Advanced Python Programming"]
    
    return mock

@pytest.fixture
def mock_document_processor():
    """Mock document processor for testing"""
    mock = MagicMock()
    
    # Mock process_file method
    mock.process_file.return_value = (
        MagicMock(
            title="Test Course",
            link="https://example.com/test",
            instructor="Test Instructor",
            lessons=[
                MagicMock(lesson_number=0, title="Introduction", link=None)
            ]
        ),
        [
            MagicMock(
                content="Test content chunk",
                metadata={
                    "course_title": "Test Course",
                    "lesson_number": 0,
                    "lesson_title": "Introduction"
                }
            )
        ]
    )
    
    return mock

@pytest.fixture
def mock_ai_generator():
    """Mock AI generator for testing"""
    mock = MagicMock()
    mock.generate_response.return_value = "This is a test response from AI"
    return mock

@pytest.fixture
def mock_session_manager():
    """Mock session manager for testing"""
    mock = MagicMock()
    mock.create_session.return_value = "test_session_789"
    mock.get_conversation_history.return_value = "User: Previous question\nAssistant: Previous answer"
    mock.add_exchange.return_value = None
    return mock

@pytest.fixture
def mock_config():
    """Mock configuration for testing"""
    return {
        "api_key": "test_api_key",
        "model": "test_model",
        "max_tokens": 1000,
        "temperature": 0.7,
        "chunk_size": 800,
        "chunk_overlap": 100,
        "max_conversation_history": 2
    }

@pytest.fixture
def mock_tool_manager():
    """Mock tool manager for testing"""
    mock = MagicMock()
    mock.execute_tool.return_value = "Tool execution result"
    mock.get_tool_definitions.return_value = [
        {
            "name": "search_course_content",
            "description": "Search course materials",
            "input_schema": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"}
                },
                "required": ["query"]
            }
        }
    ]
    return mock

@pytest.fixture
def mock_search_tool():
    """Mock search tool for testing"""
    mock = MagicMock()
    mock.execute.return_value = "Search results for query"
    mock.get_definition.return_value = {
        "name": "search_course_content",
        "description": "Search course materials",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string"}
            },
            "required": ["query"]
        }
    }
    mock.last_sources = ["Source 1", "Source 2"]
    return mock

# Test client fixtures
@pytest.fixture
def test_client():
    """Create test client for FastAPI app without static file mounting"""
    from fastapi import FastAPI, HTTPException
    from fastapi.testclient import TestClient
    from pydantic import BaseModel
    from typing import List, Optional
    
    # Create a test app without static file mounting
    app = FastAPI(title="Test Course Materials RAG System")
    
    # Define models
    class QueryRequest(BaseModel):
        query: str
        session_id: Optional[str] = None
    
    class QueryResponse(BaseModel):
        answer: str
        sources: List[str]
        session_id: str
    
    class CourseStats(BaseModel):
        total_courses: int
        course_titles: List[str]
    
    # Create mock RAG system
    mock_rag = MagicMock()
    mock_rag.query.return_value = (
        "This is a test response",
        ["Source 1", "Source 2"]
    )
    mock_rag.get_course_analytics.return_value = {
        "total_courses": 3,
        "course_titles": ["Course 1", "Course 2", "Course 3"]
    }
    mock_rag.session_manager.create_session.return_value = "test_session_123"
    
    # Define endpoints
    @app.post("/api/query", response_model=QueryResponse)
    async def query_documents(request: QueryRequest):
        try:
            session_id = request.session_id
            if not session_id:
                session_id = mock_rag.session_manager.create_session()
            
            answer, sources = mock_rag.query(request.query, session_id)
            
            return QueryResponse(
                answer=answer,
                sources=sources,
                session_id=session_id
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.get("/api/courses", response_model=CourseStats)
    async def get_course_stats():
        try:
            analytics = mock_rag.get_course_analytics()
            return CourseStats(
                total_courses=analytics["total_courses"],
                course_titles=analytics["course_titles"]
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.get("/")
    async def root():
        return {"message": "Course Materials RAG System API"}
    
    # Store mock_rag on app for test access
    app.mock_rag = mock_rag
    
    # Create test client
    client = TestClient(app)
    client.mock_rag = mock_rag  # Attach mock for test access
    
    return client

@pytest.fixture
def mock_anthropic_client():
    """Mock Anthropic client for testing"""
    with patch('anthropic.Anthropic') as mock_client:
        yield mock_client

# Environment variable fixtures
@pytest.fixture
def mock_env_vars(monkeypatch):
    """Set mock environment variables for testing"""
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test_api_key")
    monkeypatch.setenv("MODEL", "claude-3-sonnet-20240229")
    monkeypatch.setenv("MAX_TOKENS", "1000")
    monkeypatch.setenv("TEMPERATURE", "0.7")

# File system fixtures
@pytest.fixture
def temp_docs_dir(tmp_path):
    """Create temporary docs directory with test files"""
    docs_dir = tmp_path / "docs"
    docs_dir.mkdir()
    
    # Create sample course file
    course_file = docs_dir / "test_course.txt"
    course_file.write_text("""Course Title: Test Course
Course Link: https://example.com/test
Course Instructor: Test Instructor

Lesson 0: Introduction
This is the introduction lesson content.

Lesson 1: Basic Concepts
This lesson covers basic concepts of the subject.
""")
    
    return docs_dir

@pytest.fixture
def mock_chromadb_client():
    """Mock ChromaDB client for testing"""
    with patch('chromadb.PersistentClient') as mock_client:
        mock_collection = MagicMock()
        mock_collection.query.return_value = {
            'documents': [["Test document content"]],
            'metadatas': [[{"course_title": "Test Course", "lesson_number": 0}]],
            'distances': [[0.1]]
        }
        mock_collection.count.return_value = 10
        
        mock_instance = MagicMock()
        mock_instance.get_or_create_collection.return_value = mock_collection
        mock_client.return_value = mock_instance
        
        yield mock_client

# Helper fixtures for async testing
@pytest.fixture
def async_mock():
    """Helper to create async mock functions"""
    import asyncio
    
    def create_async_mock(return_value=None):
        async def async_func(*args, **kwargs):
            return return_value
        return MagicMock(side_effect=async_func)
    
    return create_async_mock