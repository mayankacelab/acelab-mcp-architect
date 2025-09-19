#!/usr/bin/env node

/**
 * Simple test script to validate the Acelab MCP server functionality
 */

const axios = require('axios');

const SERVER_URL = 'http://localhost:3000';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testEndpoint(description, method, url, data = null) {
  console.log(`\n🧪 Testing: ${description}`);
  try {
    const config = {
      method,
      url: `${SERVER_URL}${url}`,
      headers: { 'Content-Type': 'application/json' }
    };
    
    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    console.log(`✅ Success: ${response.status} ${response.statusText}`);
    console.log('📄 Response:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.log(`❌ Error: ${error.response?.status || 'Network'} ${error.response?.statusText || error.message}`);
    if (error.response?.data) {
      console.log('📄 Error details:', JSON.stringify(error.response.data, null, 2));
    }
    return null;
  }
}

async function runTests() {
  console.log('🚀 Starting Acelab MCP Server Tests');
  console.log('=' .repeat(50));

  // Test health endpoint
  await testEndpoint('Health Check', 'GET', '/health');

  await sleep(500);

  // Test configuration
  await testEndpoint('Configuration', 'GET', '/config');

  await sleep(500);

  // Test tools listing
  await testEndpoint('Tools Listing', 'GET', '/tools');

  await sleep(500);

  // Test connection test tool
  await testEndpoint('Connection Test Tool', 'POST', '/tools/acelab_test_connection/execute', {});

  await sleep(500);

  // Test API call tool (this will fail with placeholder token, but should show proper error handling)
  await testEndpoint('API Call Tool', 'POST', '/tools/acelab_api_call/execute', {
    endpoint: '/test',
    method: 'GET'
  });

  await sleep(500);

  // Test token update tool
  await testEndpoint('Token Update Tool', 'POST', '/tools/acelab_update_token/execute', {
    token: 'new_test_token'
  });

  console.log('\n' + '=' .repeat(50));
  console.log('🏁 Tests completed!');
  console.log('\n💡 To test with a real OAuth token:');
  console.log('   1. Update the OAUTH_TOKEN in .env file');
  console.log('   2. Restart the server');
  console.log('   3. Run the tests again');
  console.log('\n🌐 To test SSE (Server-Sent Events):');
  console.log('   curl -N http://localhost:3000/events');
}

if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests, testEndpoint };