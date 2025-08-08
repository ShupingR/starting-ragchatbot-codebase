import pytest
from unittest.mock import MagicMock, patch
import json


class TestQueryEndpoint:
    """Test the /api/query endpoint"""
    
    def test_query_with_session_id(self, test_client):
        """Test query with existing session ID"""
        response = test_client.post(
            "/api/query",
            json={
                "query": "What is machine learning?",
                "session_id": "existing_session_123"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "answer" in data
        assert "sources" in data
        assert "session_id" in data
        assert data["session_id"] == "existing_session_123"
        assert isinstance(data["sources"], list)
        assert len(data["sources"]) == 2
    
    def test_query_without_session_id(self, test_client):
        """Test query without session ID (should create new session)"""
        response = test_client.post(
            "/api/query",
            json={"query": "Explain neural networks"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "answer" in data
        assert "sources" in data
        assert "session_id" in data
        assert data["session_id"] == "test_session_123"  # Mock creates this
    
    def test_query_empty_string(self, test_client):
        """Test query with empty string"""
        response = test_client.post(
            "/api/query",
            json={"query": ""}
        )
        
        # Should still work but might return different response
        assert response.status_code in [200, 422]  # 422 if validation fails
    
    def test_query_long_text(self, test_client):
        """Test query with very long text"""
        long_query = "What is " + "machine learning and " * 100 + "how does it work?"
        response = test_client.post(
            "/api/query",
            json={"query": long_query}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "answer" in data
    
    def test_query_special_characters(self, test_client):
        """Test query with special characters"""
        response = test_client.post(
            "/api/query",
            json={"query": "What about ML & AI? <script>alert('test')</script>"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "answer" in data
        # Ensure no script tags in response
        assert "<script>" not in data["answer"]
    
    def test_query_unicode_characters(self, test_client):
        """Test query with Unicode characters"""
        response = test_client.post(
            "/api/query",
            json={"query": "Explain 机器学习 (machine learning) 🤖"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "answer" in data
    
    def test_query_missing_query_field(self, test_client):
        """Test request missing query field"""
        response = test_client.post(
            "/api/query",
            json={"session_id": "test_123"}
        )
        
        assert response.status_code == 422  # Validation error
        assert "detail" in response.json()
    
    def test_query_invalid_json(self, test_client):
        """Test request with invalid JSON"""
        response = test_client.post(
            "/api/query",
            data="invalid json{",
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 422
    
    def test_query_error_handling(self, test_client):
        """Test error handling when RAG system raises exception"""
        # Make the mock raise an exception
        test_client.mock_rag.query.side_effect = Exception("Database error")
        
        response = test_client.post(
            "/api/query",
            json={"query": "Test query"}
        )
        
        assert response.status_code == 500
        data = response.json()
        assert "detail" in data
        assert "Database error" in data["detail"]
        
        # Reset the mock
        test_client.mock_rag.query.side_effect = None
        test_client.mock_rag.query.return_value = ("Test response", ["Source 1"])
    
    def test_query_response_structure(self, test_client):
        """Test the structure of successful query response"""
        response = test_client.post(
            "/api/query",
            json={
                "query": "Test query",
                "session_id": "test_session"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check response structure
        assert isinstance(data, dict)
        assert isinstance(data["answer"], str)
        assert isinstance(data["sources"], list)
        assert isinstance(data["session_id"], str)
        
        # Check sources structure
        for source in data["sources"]:
            assert isinstance(source, str)


class TestCoursesEndpoint:
    """Test the /api/courses endpoint"""
    
    def test_get_courses_success(self, test_client):
        """Test successful retrieval of course statistics"""
        response = test_client.get("/api/courses")
        
        assert response.status_code == 200
        data = response.json()
        assert "total_courses" in data
        assert "course_titles" in data
        assert data["total_courses"] == 3
        assert len(data["course_titles"]) == 3
    
    def test_courses_response_structure(self, test_client):
        """Test the structure of courses response"""
        response = test_client.get("/api/courses")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check response structure
        assert isinstance(data, dict)
        assert isinstance(data["total_courses"], int)
        assert isinstance(data["course_titles"], list)
        
        # Check course titles
        for title in data["course_titles"]:
            assert isinstance(title, str)
            assert len(title) > 0
    
    def test_courses_error_handling(self, test_client):
        """Test error handling when get_course_analytics raises exception"""
        # Make the mock raise an exception
        test_client.mock_rag.get_course_analytics.side_effect = Exception("Analytics error")
        
        response = test_client.get("/api/courses")
        
        assert response.status_code == 500
        data = response.json()
        assert "detail" in data
        assert "Analytics error" in data["detail"]
        
        # Reset the mock
        test_client.mock_rag.get_course_analytics.side_effect = None
        test_client.mock_rag.get_course_analytics.return_value = {
            "total_courses": 3,
            "course_titles": ["Course 1", "Course 2", "Course 3"]
        }
    
    def test_courses_empty_database(self, test_client):
        """Test courses endpoint when no courses are loaded"""
        # Configure mock to return empty results
        test_client.mock_rag.get_course_analytics.return_value = {
            "total_courses": 0,
            "course_titles": []
        }
        
        response = test_client.get("/api/courses")
        
        assert response.status_code == 200
        data = response.json()
        assert data["total_courses"] == 0
        assert data["course_titles"] == []
        
        # Reset the mock
        test_client.mock_rag.get_course_analytics.return_value = {
            "total_courses": 3,
            "course_titles": ["Course 1", "Course 2", "Course 3"]
        }


class TestRootEndpoint:
    """Test the root / endpoint"""
    
    def test_root_endpoint(self, test_client):
        """Test root endpoint returns API information"""
        response = test_client.get("/")
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "RAG System" in data["message"]


class TestConcurrentRequests:
    """Test concurrent request handling"""
    
    def test_multiple_queries_different_sessions(self, test_client):
        """Test multiple queries with different session IDs"""
        sessions = ["session_1", "session_2", "session_3"]
        responses = []
        
        for session_id in sessions:
            response = test_client.post(
                "/api/query",
                json={
                    "query": f"Query for {session_id}",
                    "session_id": session_id
                }
            )
            responses.append(response)
        
        # All should succeed
        for i, response in enumerate(responses):
            assert response.status_code == 200
            data = response.json()
            assert data["session_id"] == sessions[i]
    
    def test_mixed_endpoint_requests(self, test_client):
        """Test mixed requests to different endpoints"""
        # Query endpoint
        query_response = test_client.post(
            "/api/query",
            json={"query": "Test query"}
        )
        
        # Courses endpoint
        courses_response = test_client.get("/api/courses")
        
        # Root endpoint
        root_response = test_client.get("/")
        
        # All should succeed
        assert query_response.status_code == 200
        assert courses_response.status_code == 200
        assert root_response.status_code == 200


class TestEdgeCases:
    """Test edge cases and boundary conditions"""
    
    def test_query_with_null_session_id(self, test_client):
        """Test query with null session_id"""
        response = test_client.post(
            "/api/query",
            json={
                "query": "Test query",
                "session_id": None
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        # Should create new session
        assert data["session_id"] == "test_session_123"
    
    def test_query_with_numeric_session_id(self, test_client):
        """Test query with numeric session_id (should be converted to string)"""
        response = test_client.post(
            "/api/query",
            json={
                "query": "Test query",
                "session_id": 12345
            }
        )
        
        # Should either work or fail validation
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data["session_id"], (str, int))
    
    def test_query_with_extra_fields(self, test_client):
        """Test query with extra fields (should be ignored)"""
        response = test_client.post(
            "/api/query",
            json={
                "query": "Test query",
                "session_id": "test_123",
                "extra_field": "should be ignored",
                "another_field": 123
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "extra_field" not in data
        assert "another_field" not in data
    
    def test_courses_with_query_params(self, test_client):
        """Test courses endpoint ignores query parameters"""
        response = test_client.get("/api/courses?filter=ml&sort=asc")
        
        assert response.status_code == 200
        data = response.json()
        # Should return all courses regardless of params
        assert data["total_courses"] == 3


class TestHTTPMethods:
    """Test HTTP method restrictions"""
    
    def test_query_get_not_allowed(self, test_client):
        """Test GET method not allowed for query endpoint"""
        response = test_client.get("/api/query")
        assert response.status_code == 405  # Method not allowed
    
    def test_courses_post_not_allowed(self, test_client):
        """Test POST method not allowed for courses endpoint"""
        response = test_client.post("/api/courses", json={})
        assert response.status_code == 405
    
    def test_query_put_not_allowed(self, test_client):
        """Test PUT method not allowed for query endpoint"""
        response = test_client.put(
            "/api/query",
            json={"query": "Test"}
        )
        assert response.status_code == 405
    
    def test_query_delete_not_allowed(self, test_client):
        """Test DELETE method not allowed for query endpoint"""
        response = test_client.delete("/api/query")
        assert response.status_code == 405


class TestContentTypes:
    """Test content type handling"""
    
    def test_query_json_content_type(self, test_client):
        """Test query with correct JSON content type"""
        response = test_client.post(
            "/api/query",
            json={"query": "Test query"},
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/json"
    
    def test_query_form_data_not_accepted(self, test_client):
        """Test query with form data is not accepted"""
        response = test_client.post(
            "/api/query",
            data={"query": "Test query"},
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        assert response.status_code == 422
    
    def test_courses_returns_json(self, test_client):
        """Test courses endpoint returns JSON"""
        response = test_client.get("/api/courses")
        
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/json"
        
        # Verify it's valid JSON
        data = response.json()
        assert isinstance(data, dict)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])