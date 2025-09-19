// Example usage of the Acelab MCP server
// This demonstrates how to interact with the server programmatically

const axios = require('axios');

const SERVER_URL = 'http://localhost:3000';

// Example 1: Update OAuth token
async function updateToken(newToken) {
  try {
    const response = await axios.post(`${SERVER_URL}/auth/token`, {
      token: newToken
    });
    console.log('Token updated:', response.data);
    return response.data;
  } catch (error) {
    console.error('Failed to update token:', error.response?.data || error.message);
  }
}

// Example 2: Make an API call through the MCP server
async function makeApiCall(endpoint, method = 'GET', data = null) {
  try {
    const response = await axios.post(`${SERVER_URL}/tools/acelab_api_call/execute`, {
      endpoint,
      method,
      data
    });
    console.log('API call result:', response.data);
    return response.data;
  } catch (error) {
    console.error('API call failed:', error.response?.data || error.message);
  }
}

// Example 3: Start streaming events
async function startStreaming(endpoint, interval = 5000) {
  try {
    const response = await axios.post(`${SERVER_URL}/tools/acelab_stream_events/execute`, {
      endpoint,
      interval
    });
    console.log('Streaming started:', response.data);
    return response.data;
  } catch (error) {
    console.error('Failed to start streaming:', error.response?.data || error.message);
  }
}

// Example 4: Listen to Server-Sent Events
function listenToSSE() {
  const EventSource = require('eventsource');
  const eventSource = new EventSource(`${SERVER_URL}/events`);

  eventSource.onopen = function() {
    console.log('SSE connection opened');
  };

  eventSource.onmessage = function(event) {
    console.log('SSE Message:', JSON.parse(event.data));
  };

  eventSource.addEventListener('api_call_success', function(event) {
    console.log('API Call Success:', JSON.parse(event.data));
  });

  eventSource.addEventListener('stream_data', function(event) {
    console.log('Stream Data:', JSON.parse(event.data));
  });

  eventSource.addEventListener('connection_test', function(event) {
    console.log('Connection Test:', JSON.parse(event.data));
  });

  eventSource.onerror = function(error) {
    console.error('SSE Error:', error);
  };

  return eventSource;
}

// Example usage
async function runExample() {
  console.log('🚀 Acelab MCP Server Example Usage\n');

  // Example 1: Update token (replace with your actual token)
  console.log('1. Updating OAuth token...');
  await updateToken('your_actual_oauth_token_here');

  // Example 2: Test connection
  console.log('\n2. Testing connection...');
  await makeApiCall('/', 'GET');

  // Example 3: Make a sample API call
  console.log('\n3. Making API call to /users...');
  await makeApiCall('/users', 'GET');

  // Example 4: Start streaming
  console.log('\n4. Starting event stream...');
  await startStreaming('/events', 3000);

  // Example 5: Listen to SSE (uncomment to test)
  console.log('\n5. Starting SSE listener...');
  console.log('   (To test SSE, install eventsource: npm install eventsource)');
  // const eventSource = listenToSSE();
  
  // Clean up after 30 seconds
  // setTimeout(() => {
  //   eventSource.close();
  //   console.log('SSE connection closed');
  // }, 30000);
}

if (require.main === module) {
  runExample().catch(console.error);
}

module.exports = {
  updateToken,
  makeApiCall,
  startStreaming,
  listenToSSE
};