import pytest
from unittest.mock import Mock, MagicMock, patch, call
import anthropic
from typing import List, Dict, Any

# Import the module to test
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from ai_generator import AIGenerator


class MockContentBlock:
    """Mock Anthropic content block for tool use"""
    def __init__(self, type: str, text: str = None, name: str = None, input: Dict = None, id: str = None):
        self.type = type
        self.text = text
        self.name = name
        self.input = input or {}
        self.id = id or "test_tool_id"


class MockResponse:
    """Mock Anthropic API response"""
    def __init__(self, content: List[MockContentBlock], stop_reason: str = "end_turn"):
        self.content = content
        self.stop_reason = stop_reason


@pytest.fixture
def mock_anthropic_client():
    """Mock Anthropic client"""
    with patch('anthropic.Anthropic') as mock_client:
        yield mock_client


@pytest.fixture
def ai_generator(mock_anthropic_client):
    """Create AI generator instance with mocked client"""
    mock_instance = MagicMock()
    mock_anthropic_client.return_value = mock_instance
    generator = AIGenerator(api_key="test_key", model="test_model")
    return generator


@pytest.fixture
def mock_tool_manager():
    """Mock tool manager for testing"""
    manager = Mock()
    manager.execute_tool = Mock(return_value="Tool execution result")
    return manager


@pytest.fixture
def sample_tools():
    """Sample tool definitions"""
    return [
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
        },
        {
            "name": "get_course_outline",
            "description": "Get course outline",
            "input_schema": {
                "type": "object",
                "properties": {
                    "course_title": {"type": "string"}
                },
                "required": ["course_title"]
            }
        }
    ]


class TestSequentialToolCalling:
    """Test sequential tool calling functionality"""
    
    def test_no_tools_direct_response(self, ai_generator):
        """Test direct response when no tools are used"""
        # Setup
        mock_response = MockResponse(
            content=[MockContentBlock(type="text", text="Direct answer without tools")],
            stop_reason="end_turn"
        )
        ai_generator.client.messages.create.return_value = mock_response
        
        # Execute
        result = ai_generator.generate_response(
            query="What is 2+2?",
            tools=None,
            tool_manager=None
        )
        
        # Verify
        assert result == "Direct answer without tools"
        assert ai_generator.client.messages.create.call_count == 1
    
    def test_single_tool_call(self, ai_generator, mock_tool_manager, sample_tools):
        """Test single tool call followed by final response"""
        # Setup
        tool_use_response = MockResponse(
            content=[
                MockContentBlock(
                    type="tool_use",
                    name="search_course_content",
                    input={"query": "machine learning"},
                    id="tool_1"
                )
            ],
            stop_reason="tool_use"
        )
        
        final_response = MockResponse(
            content=[MockContentBlock(type="text", text="Here's information about machine learning")],
            stop_reason="end_turn"
        )
        
        # Configure mock to return different responses
        ai_generator.client.messages.create.side_effect = [tool_use_response, final_response]
        mock_tool_manager.execute_tool.return_value = "Found 5 results about machine learning"
        
        # Execute
        result = ai_generator.generate_response(
            query="Tell me about machine learning",
            tools=sample_tools,
            tool_manager=mock_tool_manager
        )
        
        # Verify
        assert result == "Here's information about machine learning"
        assert ai_generator.client.messages.create.call_count == 2
        mock_tool_manager.execute_tool.assert_called_once_with(
            "search_course_content",
            query="machine learning"
        )
    
    def test_two_sequential_tool_calls(self, ai_generator, mock_tool_manager, sample_tools):
        """Test two sequential tool calls before final response"""
        # Setup
        first_tool_response = MockResponse(
            content=[
                MockContentBlock(
                    type="tool_use",
                    name="get_course_outline",
                    input={"course_title": "MCP"},
                    id="tool_1"
                )
            ],
            stop_reason="tool_use"
        )
        
        second_tool_response = MockResponse(
            content=[
                MockContentBlock(
                    type="tool_use",
                    name="search_course_content",
                    input={"query": "lesson 4 content"},
                    id="tool_2"
                )
            ],
            stop_reason="tool_use"
        )
        
        final_response = MockResponse(
            content=[MockContentBlock(type="text", text="Based on course outline and search results")],
            stop_reason="end_turn"
        )
        
        # Configure mock responses
        ai_generator.client.messages.create.side_effect = [
            first_tool_response,
            second_tool_response,
            final_response
        ]
        
        mock_tool_manager.execute_tool.side_effect = [
            "Course outline: Lesson 1, Lesson 2, Lesson 3, Lesson 4",
            "Lesson 4 discusses advanced topics"
        ]
        
        # Execute
        result = ai_generator.generate_response(
            query="What does lesson 4 of MCP course cover?",
            tools=sample_tools,
            tool_manager=mock_tool_manager,
            max_tool_rounds=2
        )
        
        # Verify
        assert result == "Based on course outline and search results"
        assert ai_generator.client.messages.create.call_count == 3
        assert mock_tool_manager.execute_tool.call_count == 2
        
        # Verify tool calls in order
        calls = mock_tool_manager.execute_tool.call_args_list
        assert calls[0] == call("get_course_outline", course_title="MCP")
        assert calls[1] == call("search_course_content", query="lesson 4 content")
    
    def test_max_rounds_termination(self, ai_generator, mock_tool_manager, sample_tools):
        """Test termination when max rounds reached"""
        # Setup - Claude keeps wanting to use tools
        tool_responses = [
            MockResponse(
                content=[MockContentBlock(type="tool_use", name="search_course_content", input={"query": f"query_{i}"}, id=f"tool_{i}")],
                stop_reason="tool_use"
            ) for i in range(2)
        ]
        
        # Final response when forced to stop (after max rounds, no more tools available)
        final_response = MockResponse(
            content=[MockContentBlock(type="text", text="Final answer after max rounds")],
            stop_reason="end_turn"
        )
        
        ai_generator.client.messages.create.side_effect = tool_responses + [final_response]
        
        # Execute with max_tool_rounds=2
        result = ai_generator.generate_response(
            query="Complex query",
            tools=sample_tools,
            tool_manager=mock_tool_manager,
            max_tool_rounds=2
        )
        
        # Verify
        assert result == "Final answer after max rounds"
        # Should make 2 tool calls + 1 final call without tools
        assert ai_generator.client.messages.create.call_count == 3
        assert mock_tool_manager.execute_tool.call_count == 2
    
    def test_tool_execution_error_handling(self, ai_generator, mock_tool_manager, sample_tools):
        """Test graceful handling of tool execution errors"""
        # Setup
        tool_use_response = MockResponse(
            content=[
                MockContentBlock(
                    type="tool_use",
                    name="search_course_content",
                    input={"query": "test"},
                    id="tool_1"
                )
            ],
            stop_reason="tool_use"
        )
        
        final_response = MockResponse(
            content=[MockContentBlock(type="text", text="Handled error gracefully")],
            stop_reason="end_turn"
        )
        
        ai_generator.client.messages.create.side_effect = [tool_use_response, final_response]
        
        # Make tool execution raise an error
        mock_tool_manager.execute_tool.side_effect = Exception("Tool execution failed")
        
        # Execute
        result = ai_generator.generate_response(
            query="Search for something",
            tools=sample_tools,
            tool_manager=mock_tool_manager
        )
        
        # Verify - should continue and include error in tool results
        assert result == "Handled error gracefully"
        assert ai_generator.client.messages.create.call_count == 2
    
    def test_api_call_error_handling(self, ai_generator, mock_tool_manager, sample_tools):
        """Test handling of API call errors"""
        # Setup - API call raises exception
        ai_generator.client.messages.create.side_effect = Exception("API error")
        
        # Execute
        result = ai_generator.generate_response(
            query="Test query",
            tools=sample_tools,
            tool_manager=mock_tool_manager
        )
        
        # Verify
        assert result == "I encountered an error while processing your request."
        assert ai_generator.client.messages.create.call_count == 1
    
    def test_conversation_history_preserved(self, ai_generator, mock_tool_manager, sample_tools):
        """Test that conversation history is preserved in system prompt"""
        # Setup
        mock_response = MockResponse(
            content=[MockContentBlock(type="text", text="Answer with context")],
            stop_reason="end_turn"
        )
        ai_generator.client.messages.create.return_value = mock_response
        
        conversation_history = "User: Previous question\nAssistant: Previous answer"
        
        # Execute
        result = ai_generator.generate_response(
            query="New question",
            conversation_history=conversation_history,
            tools=sample_tools,
            tool_manager=mock_tool_manager
        )
        
        # Verify system prompt includes conversation history
        call_args = ai_generator.client.messages.create.call_args
        assert "Previous conversation:" in call_args[1]["system"]
        assert conversation_history in call_args[1]["system"]
    
    def test_message_accumulation_across_rounds(self, ai_generator, mock_tool_manager, sample_tools):
        """Test that messages accumulate correctly across tool rounds"""
        # Setup
        tool_response = MockResponse(
            content=[MockContentBlock(type="tool_use", name="search_course_content", input={"query": "test"}, id="tool_1")],
            stop_reason="tool_use"
        )
        
        final_response = MockResponse(
            content=[MockContentBlock(type="text", text="Final answer")],
            stop_reason="end_turn"
        )
        
        ai_generator.client.messages.create.side_effect = [tool_response, final_response]
        
        # Execute
        result = ai_generator.generate_response(
            query="Test query",
            tools=sample_tools,
            tool_manager=mock_tool_manager
        )
        
        # Verify message structure in second API call
        second_call_args = ai_generator.client.messages.create.call_args_list[1]
        messages = second_call_args[1]["messages"]
        
        # Should have: user query, assistant tool use, user tool results
        assert len(messages) == 3
        assert messages[0]["role"] == "user"
        assert messages[0]["content"] == "Test query"
        assert messages[1]["role"] == "assistant"
        assert messages[2]["role"] == "user"
        assert messages[2]["content"][0]["type"] == "tool_result"
    
    def test_no_tools_after_max_rounds(self, ai_generator, mock_tool_manager, sample_tools):
        """Test that tools are not included in final API call after max rounds"""
        # Setup
        tool_responses = [
            MockResponse(
                content=[MockContentBlock(type="tool_use", name="search_course_content", input={"query": f"q{i}"}, id=f"t{i}")],
                stop_reason="tool_use"
            ) for i in range(2)
        ]
        
        final_response = MockResponse(
            content=[MockContentBlock(type="text", text="Final")],
            stop_reason="end_turn"
        )
        
        ai_generator.client.messages.create.side_effect = tool_responses + [final_response]
        
        # Execute
        result = ai_generator.generate_response(
            query="Query",
            tools=sample_tools,
            tool_manager=mock_tool_manager,
            max_tool_rounds=2
        )
        
        # Verify final call has no tools
        final_call_args = ai_generator.client.messages.create.call_args_list[-1]
        assert "tools" not in final_call_args[1]
        assert "tool_choice" not in final_call_args[1]


class TestErrorScenarios:
    """Test various error scenarios"""
    
    def test_critical_tool_execution_error(self, ai_generator, mock_tool_manager, sample_tools):
        """Test handling of critical errors during tool execution"""
        # Setup
        tool_response = MockResponse(
            content=[MockContentBlock(type="tool_use", name="bad_tool", input={}, id="tool_1")],
            stop_reason="tool_use"
        )
        
        ai_generator.client.messages.create.return_value = tool_response
        
        # Make _execute_tools_and_update_messages raise an exception
        with patch.object(ai_generator, '_execute_tools_and_update_messages', return_value=None):
            result = ai_generator.generate_response(
                query="Test",
                tools=sample_tools,
                tool_manager=mock_tool_manager
            )
            
            assert result == "I encountered an error while processing tool results."
    
    def test_empty_tool_results(self, ai_generator, mock_tool_manager, sample_tools):
        """Test handling when tool returns empty results"""
        # Setup
        tool_response = MockResponse(
            content=[MockContentBlock(type="tool_use", name="search_course_content", input={"query": "xyz"}, id="tool_1")],
            stop_reason="tool_use"
        )
        
        final_response = MockResponse(
            content=[MockContentBlock(type="text", text="No results found")],
            stop_reason="end_turn"
        )
        
        ai_generator.client.messages.create.side_effect = [tool_response, final_response]
        mock_tool_manager.execute_tool.return_value = ""
        
        # Execute
        result = ai_generator.generate_response(
            query="Search for xyz",
            tools=sample_tools,
            tool_manager=mock_tool_manager
        )
        
        # Verify it handles empty results gracefully
        assert result == "No results found"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])