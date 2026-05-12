# n8n Workflow — Curl Commands for Each Node

## Prerequisites
- n8n running at `http://localhost:5678`
- Replace `YOUR_OPENAI_API_KEY` with your actual key
- Replace `<YOUR_TOPIC>` with **any topic** you want — examples:
  - `"Library Management System"`
  - `"E-Commerce Platform"`
  - `"Social Media Application"`
  - `"University Enrollment System"`
  - `"Online Food Delivery App"`

---

## Node 1: Webhook (Trigger)

This is the entry point. You call this from your ER Architect app.

```bash
curl -X POST http://localhost:5678/webhook/er-generate ^
  -H "Content-Type: application/json" ^
  -d "{\"topic\": \"<YOUR_TOPIC>\"}"
```

**What it does:** Receives the topic and triggers the workflow.

---

## Node 2: AI Model (OpenAI GPT-4o)

This is what the OpenAI node does internally — a direct API call to OpenAI.
The topic is passed dynamically from the webhook body (`$json.body.topic`):

```bash
curl -X POST https://api.openai.com/v1/chat/completions ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer YOUR_OPENAI_API_KEY" ^
  -d "{\"model\": \"gpt-4o-mini\", \"messages\": [{\"role\": \"system\", \"content\": \"You are an expert database architect. Given a topic, generate a complete ER (Entity-Relationship) schema. Return ONLY valid JSON in this exact format, no markdown, no explanation: {\\\"entities\\\": [{\\\"name\\\": \\\"EntityName\\\", \\\"attributes\\\": [\\\"attr1\\\", \\\"attr2\\\"], \\\"primaryKey\\\": \\\"attr1\\\"}], \\\"relationships\\\": [{\\\"from\\\": \\\"Entity1\\\", \\\"to\\\": \\\"Entity2\\\", \\\"name\\\": \\\"relationship_name\\\", \\\"cardFrom\\\": \\\"1\\\", \\\"cardTo\\\": \\\"N\\\"}]}. Rules: Each entity must have at least 3 meaningful attributes. Always include a primary key. Use PascalCase for entities, camelCase for attributes. Include all relevant relationships with cardinality (1, N, M, 0..1, 0..N). Be thorough with 5-10 entities for complex topics.\"}, {\"role\": \"user\", \"content\": \"Generate ER schema for: <YOUR_TOPIC>\"}], \"temperature\": 0.7}"
```

**If using Google Gemini instead:**

```bash
curl -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=YOUR_GEMINI_API_KEY" ^
  -H "Content-Type: application/json" ^
  -d "{\"contents\": [{\"parts\": [{\"text\": \"You are an expert database architect. Given a topic, generate a complete ER schema. Return ONLY valid JSON: {\\\"entities\\\": [{\\\"name\\\": \\\"EntityName\\\", \\\"attributes\\\": [\\\"attr1\\\", \\\"attr2\\\"], \\\"primaryKey\\\": \\\"attr1\\\"}], \\\"relationships\\\": [{\\\"from\\\": \\\"Entity1\\\", \\\"to\\\": \\\"Entity2\\\", \\\"name\\\": \\\"rel_name\\\", \\\"cardFrom\\\": \\\"1\\\", \\\"cardTo\\\": \\\"N\\\"}]}. Each entity must have 3+ attributes with a primary key. Use PascalCase for entities. Include 5-10 entities. Topic: <YOUR_TOPIC>\"}]}], \"generationConfig\": {\"responseMimeType\": \"application/json\"}}"
```

---

## Node 3: Code (JSON Parser)

This node runs JavaScript to clean the AI response. Here's the equivalent logic as a curl test using Node.js:

```bash
node -e "const raw = '{\"entities\":[{\"name\":\"Patient\",\"attributes\":[\"patientId\",\"name\",\"dob\"],\"primaryKey\":\"patientId\"}],\"relationships\":[]}'; const schema = JSON.parse(raw); console.log(JSON.stringify(schema, null, 2));"
```

This node doesn't make an HTTP call — it processes data in-memory inside n8n.

---

## Full Workflow Test (End-to-End)

Once the workflow is active in n8n, this single curl triggers the entire pipeline:

```bash
curl -X POST http://localhost:5678/webhook/er-generate ^
  -H "Content-Type: application/json" ^
  -d "{\"topic\": \"<YOUR_TOPIC>\"}"
```

---

## Auto-Create the Workflow via n8n API

First, generate an API key in n8n: **Settings → API → Create API Key**

Then run this curl to create the entire workflow in one shot:

```bash
curl -X POST http://localhost:5678/api/v1/workflows ^
  -H "Content-Type: application/json" ^
  -H "X-N8N-API-KEY: YOUR_N8N_API_KEY" ^
  -d "{\"name\": \"ER Diagram AI Generator\", \"nodes\": [{\"parameters\": {\"httpMethod\": \"POST\", \"path\": \"er-generate\", \"responseMode\": \"lastNode\", \"options\": {}}, \"id\": \"webhook-node\", \"name\": \"Webhook\", \"type\": \"n8n-nodes-base.webhook\", \"typeVersion\": 2, \"position\": [250, 300]}, {\"parameters\": {\"model\": \"gpt-4o-mini\", \"messages\": {\"values\": [{\"content\": \"You are an expert database architect. Given a topic, generate a complete ER (Entity-Relationship) schema.\\n\\nReturn ONLY valid JSON in this exact format, no markdown, no explanation:\\n{\\\"entities\\\": [{\\\"name\\\": \\\"EntityName\\\", \\\"attributes\\\": [\\\"attr1\\\", \\\"attr2\\\", \\\"attr3\\\"], \\\"primaryKey\\\": \\\"attr1\\\"}], \\\"relationships\\\": [{\\\"from\\\": \\\"Entity1\\\", \\\"to\\\": \\\"Entity2\\\", \\\"name\\\": \\\"relationship_name\\\", \\\"cardFrom\\\": \\\"1\\\", \\\"cardTo\\\": \\\"N\\\"}]}\\n\\nRules: Each entity must have at least 3 meaningful attributes. Always include a primary key (usually an ID field). Use PascalCase for entities, camelCase for attributes. Include all relevant relationships with proper cardinality. Be thorough — include 5-10 entities.\"}]}, \"prompt\": {\"value\": \"={{ $json.body.topic }}\"}, \"options\": {}}, \"id\": \"openai-node\", \"name\": \"OpenAI Chat\", \"type\": \"@n8n/n8n-nodes-langchain.openAi\", \"typeVersion\": 1, \"position\": [500, 300]}, {\"parameters\": {\"jsCode\": \"const aiResponse = $input.first().json;\\nlet schema;\\nif (aiResponse.message && aiResponse.message.content) {\\n  const content = aiResponse.message.content;\\n  const cleaned = content.replace(/```json\\\\n?/g, '').replace(/```\\\\n?/g, '').trim();\\n  schema = JSON.parse(cleaned);\\n} else if (aiResponse.text) {\\n  const cleaned = aiResponse.text.replace(/```json\\\\n?/g, '').replace(/```\\\\n?/g, '').trim();\\n  schema = JSON.parse(cleaned);\\n} else if (aiResponse.entities) {\\n  schema = aiResponse;\\n}\\nif (!schema || !schema.entities) {\\n  throw new Error('Invalid schema format');\\n}\\nreturn [{ json: schema }];\"}, \"id\": \"code-node\", \"name\": \"Parse Response\", \"type\": \"n8n-nodes-base.code\", \"typeVersion\": 2, \"position\": [750, 300]}], \"connections\": {\"Webhook\": {\"main\": [[{\"node\": \"OpenAI Chat\", \"type\": \"main\", \"index\": 0}]]}, \"OpenAI Chat\": {\"main\": [[{\"node\": \"Parse Response\", \"type\": \"main\", \"index\": 0}]]}}, \"active\": true, \"settings\": {\"executionOrder\": \"v1\"}}"
```

---

## Quick Reference Table

| Node | Purpose | Makes HTTP Call? | Curl Provided? |
|------|---------|-----------------|----------------|
| **Webhook** | Receives topic from browser | No (it's the receiver) | ✅ Test trigger |
| **OpenAI Chat** | Sends topic to AI, gets ER schema | Yes → OpenAI API | ✅ Direct API call |
| **Code (Parser)** | Cleans JSON response | No (in-memory) | ✅ Node.js equivalent |
| **Full Pipeline** | End-to-end test | Webhook → AI → Parse | ✅ Single curl |
| **Create Workflow** | Auto-setup via n8n API | Yes → n8n API | ✅ Workflow creation |
