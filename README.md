# Acelab MCP Architect

A Model Context Protocol (MCP) server with Server-Sent Events (SSE) support for calling acelab API endpoints with OAuth authentication.

## Features

- **MCP Protocol Support**: Implements tools for interacting with acelab API
- **OAuth Authentication**: Secure token-based authentication for API calls
- **Server-Sent Events**: Real-time streaming of API responses and events
- **API Proxy**: Direct proxy functionality for acelab endpoints
- **Error Handling**: Comprehensive error handling and logging
- **TypeScript**: Full TypeScript support with type safety

## Available Tools

### 1. acelab_api_call
Make authenticated API calls to acelab endpoints.

**Parameters:**
- `endpoint` (required): API endpoint path (e.g., "/users", "/data")
- `method` (optional): HTTP method (GET, POST, PUT, DELETE, PATCH) - defaults to GET
- `data` (optional): Request body data for POST/PUT/PATCH requests
- `params` (optional): Query parameters as key-value pairs
- `headers` (optional): Additional headers to include

### 2. acelab_stream_events
Start streaming real-time events from acelab API.

**Parameters:**
- `endpoint` (required): API endpoint to stream from
- `interval` (optional): Polling interval in milliseconds (default: 5000)
- `filters` (optional): Filters to apply to the streaming data

### 3. acelab_update_token
Update the OAuth token for API authentication.

**Parameters:**
- `token` (required): New OAuth bearer token

### 4. acelab_test_connection
Test the connection to acelab API.

**Parameters:** None

### 5. acelab_create_project
Create a new project in acelab using admin API.

**Parameters:**
- `name` (required): Project name
- `projectOwnerId` (required): UUID of the project owner
- `typeId` (optional): Project type UUID
- `stateId` (optional): State UUID  
- `phaseId` (optional): Phase UUID
- `budgetId` (optional): Budget UUID
- `googlePlaceId` (optional): Google Place ID

### 6. acelab_get_user_projects
Get all projects for the currently logged in user.

**Parameters:**
- `orderBy` (optional): Order projects by field ('Alphabetical' or 'CreatedDate')
- `categoryId` (optional): Filter by category UUID

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd acelab-mcp-architect
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env and add your OAuth token
```

4. Build the project:
```bash
npm run build
```

## Usage

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm run build
npm start
```

## API Endpoints

### Health Check
```
GET /health
```

### List Available Tools
```
GET /tools
```

### Execute a Tool
```
POST /tools/{toolName}/execute
Content-Type: application/json

{
  "endpoint": "/your-endpoint",
  "method": "GET"
}
```

### Server-Sent Events
```
GET /events
```
Connect to this endpoint to receive real-time events from the server.

### API Proxy
```
GET|POST|PUT|DELETE /api/*
```
Direct proxy to acelab API endpoints.

### Configuration
```
GET /config
```

### Update Token
```
POST /auth/token
Content-Type: application/json

{
  "token": "your_new_token"
}
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OAUTH_TOKEN` | Yes | - | OAuth token for acelab API |
| `API_BASE_URL` | No | acelab dev URL | Base URL for acelab API |
| `PORT` | No | 3000 | Server port |
| `CORS_ORIGINS` | No | * | Comma-separated CORS origins |
| `LOG_LEVEL` | No | info | Log level (error, warn, info, debug) |

## Examples

### Using curl

#### Test connection:
```bash
curl -X POST http://localhost:3000/tools/acelab_test_connection/execute \
  -H "Content-Type: application/json" \
  -d "{}"
```

#### Make an API call:
```bash
curl -X POST http://localhost:3000/tools/acelab_api_call/execute \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint": "/users",
    "method": "GET"
  }'
```

#### Stream events:
```bash
curl -X POST http://localhost:3000/tools/acelab_stream_events/execute \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint": "/events",
    "interval": 3000
  }'
```

#### Get user projects:
```bash
curl -X POST http://localhost:3000/tools/acelab_get_user_projects/execute \
  -H "Content-Type: application/json" \
  -d '{
    "orderBy": "CreatedDate"
  }'
```

#### Create a project:
```bash
curl -X POST http://localhost:3000/tools/acelab_create_project/execute \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My New Project",
    "projectOwnerId": "123e4567-e89b-12d3-a456-426614174000"
  }'
```

#### Listen to SSE:
```bash
curl -N http://localhost:3000/events
```

### Using JavaScript

```javascript
// Connect to SSE
const eventSource = new EventSource('http://localhost:3000/events');

eventSource.onmessage = (event) => {
  console.log('Received:', JSON.parse(event.data));
};

eventSource.addEventListener('api_call_success', (event) => {
  console.log('API call successful:', JSON.parse(event.data));
});

// Make API call
fetch('http://localhost:3000/tools/acelab_api_call/execute', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    endpoint: '/your-endpoint',
    method: 'GET'
  })
})
.then(response => response.json())
.then(data => console.log(data));
```

## Development

### Linting
```bash
npm run lint
npm run lint:fix
```

### Testing
```bash
npm test
```

## License

MIT