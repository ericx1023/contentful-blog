#!/usr/bin/env node

/**
 * Test script to check Isso server availability and wake it up if needed
 * Usage: node scripts/test-isso-server.js
 */

const https = require('https');

const ISSO_URL = process.env.NEXT_PUBLIC_ISSO_URL || 'https://isso-server.onrender.com';

console.log('🔍 Testing Isso server...');
console.log(`📍 URL: ${ISSO_URL}\n`);

// Function to make HTTP request
function testEndpoint(url, description) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    console.log(`⏳ Testing ${description}...`);

    const req = https.get(url, (res) => {
      const duration = Date.now() - startTime;
      
      if (res.statusCode === 200) {
        console.log(`✅ ${description} - OK (${res.statusCode}) - ${duration}ms`);
        resolve(true);
      } else {
        console.log(`⚠️  ${description} - Status: ${res.statusCode} - ${duration}ms`);
        resolve(false);
      }
    });

    req.on('error', (error) => {
      const duration = Date.now() - startTime;
      console.log(`❌ ${description} - Failed - ${duration}ms`);
      console.log(`   Error: ${error.message}`);
      resolve(false);
    });

    req.setTimeout(30000, () => {
      req.destroy();
      console.log(`⏱️  ${description} - Timeout (30s)`);
      resolve(false);
    });
  });
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Test 1: Embed script
  const embedOk = await testEndpoint(
    `${ISSO_URL}/js/embed.min.js`,
    'Embed Script (embed.min.js)'
  );

  console.log('');

  // Test 2: Main endpoint
  const mainOk = await testEndpoint(
    ISSO_URL,
    'Main Endpoint'
  );

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Summary
  if (embedOk && mainOk) {
    console.log('🎉 SUCCESS: Isso server is running and accessible!');
    console.log('\n💡 You can now refresh your Next.js app to load comments.');
  } else if (!embedOk && !mainOk) {
    console.log('❌ FAILED: Isso server is not responding.');
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Check if the Render service is deployed correctly');
    console.log('   2. Verify the URL is correct in .env.local');
    console.log('   3. Wait 30-60 seconds and try again (cold start)');
    console.log('   4. Check Render logs for errors');
  } else {
    console.log('⚠️  PARTIAL: Some endpoints are responding, but not all.');
    console.log('\n💡 The server might still be starting up. Try again in 10-20 seconds.');
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(console.error);





