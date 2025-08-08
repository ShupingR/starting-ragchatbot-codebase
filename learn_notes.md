
## Built-in Slash Commands:
/init: Generates a CLAUDE.md file with useful project documentation and memory, improving assistant context for your project.
/help: Lists all available commands and features.
/clear: Clears the conversation history when starting on a new feature.
/compact: Keeps a summary but resets detailed context—useful for moving between features/topics.
/ide: Automatic sharing of your current file and selection context
Displaying code changes in the IDE's diff viewer instead of just the terminal


Memory & Configuration:
Use the CLAUDE.md file for project-level memory; CLAUDE.local.md for local developer settings (not committed to git); and a global CLAUDE.md for all projects. This allows you to customize and persist understanding across sessions and projects.
Editing and Permissions:
Claude Code asks for confirmation before making changes (human-in-the-loop). You can switch to auto-accept for faster workflows if desired.
File and Line Context:
By specifying which file or line you’re referring to within VS Code, you help Claude Code return more relevant answers or changes.
Direct Memory Addition:
Use syntax like “always use UV to run the server” to add critical notes or preferences to the project memory with a simple shortcut.
Interrupt & Refocus:
Press escape to interrupt Claude Code during a process or explanation if you need to redirect or stop the current workflow.
Git Integration:
Claude Code can add, commit, and generate descriptive commit messages for your project changes, streamlining collaboration and documentation.

What you can ask claude to do
 > give me an overview of the codebase                                                                                                                   
 > how are these documents processed                            
>  trace the process of handling a user's query from frontend to backend                                                                                 
> draw a diagram that illustrates this flow
> how do I run this application
> # add new dependencies 
Uv add package name
> # always use uv to run the server, do not use pip directly
- Always use uv to run the server, do not use pip directly
- Always use uv to manage all dependencies

Use uv to run python files
ESCAPE
@ direct claude to folder or file
Shift tab twice to turn on the plan mode
Example of add clickable link
 The chat interface displays query reponses with source citations. I need to modify it so each source a   clickable link that opens the corresponding lesson video in a new tabe: - when courses are processed  into chunks in @backend/doucment_processor.py, the link of each lesson is stored in the course_catalog  collection. - modify _format_results in @backend/search_tools.py so that the lesson links are also   returned - the links should be embedded invisibly (no visible URL text)

Shift-tab once for auto accept

No then give feedback

Claude visual ability copy past screenshot

Add a '+ NEW CHAT' button to the leeft sidebard above the courses section. when clicked, it should: -   clear the current conversation in the chat window - start a new session without page reload -handle     proper cleanup on both @frontend and @backend - match the styling of existing secitons (courses, try asking) - same font size, color and uppercase formatting   
 \ enter to change line
Mcp playwright - screenshot 
claude mcp add playwright npx @playwright/mcp@latest

### MCP
/mcp

Using the playwright MCP server visit http://localhost:8000/ and view the new chat button. I want that button to look the same as the other links below for courses and try Asking. Make sure this is left aligned and that the border is removed.
In @backend/search_tools.py, add a second tool alongside the existing content-related tool. This new tool should handle course outline queries.
Functionality:
Input: course title
Output: course title, course link, and complete lesson list
For each lesson: lesson number, lesson title
- Data source: course metadata collection of the vector store
- Update the system prompt in @backend/ai_generator so that the course title, course link, the number and title of each lesson are all returned to address an outline-related queries.
- Make sure that the new tools is registered in the system

The RAG chatbot returns ‘query failed’for any content related questions.
I need you to:
1 write tests to evaluate the outputs of the execute method of the courseSearchTool in @backend/search_tools.py 

2 write tests to evaluate if @backend/ai_generator.py correctly calls for the coursSearchTool

3 Write tests to evaluate how the RAG system is handling the content -query related questions.

Save the tests in a tests folder within @backend. Run those tests against the current system to identify which components are failing. Propose fixes based on what the tests reveal is broken.

Think a lot

Testing and error debugging
Leverage testing and error feedback to identify issue and find fixes


### refactor