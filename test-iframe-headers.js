#!/usr/bin/env node

/**
 * Test script to verify iframe headers are correctly set
 */

import http from 'http';

const PORT = process.env.PORT || 3000;
const HOST = 'localhost';

console.log('🧪 Testing iframe headers...\n');

// Wait a bit for server to start
setTimeout(() => {
  const options = {
    hostname: HOST,
    port: PORT,
    path: '/',
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    console.log('📊 Response Status:', res.statusCode);
    console.log('\n📋 Headers:');
    console.log('─'.repeat(50));
    
    const headers = res.headers;
    
    // Check important headers
    const checks = {
      'X-Frame-Options': headers['x-frame-options'],
      'Content-Security-Policy': headers['content-security-policy'],
      'Access-Control-Allow-Origin': headers['access-control-allow-origin'],
      'Access-Control-Allow-Methods': headers['access-control-allow-methods'],
      'Access-Control-Allow-Headers': headers['access-control-allow-headers']
    };
    
    let allPassed = true;
    
    for (const [header, value] of Object.entries(checks)) {
      const status = value ? '✅' : '❌';
      console.log(`${status} ${header}: ${value || 'NOT SET'}`);
      
      if (header === 'X-Frame-Options' && value) {
        console.log('   ⚠️  Warning: X-Frame-Options should NOT be set for iframe support');
        allPassed = false;
      }
      
      if (header === 'Content-Security-Policy' && value && value.includes('frame-ancestors')) {
        console.log('   ✓ CSP allows iframe embedding');
      }
      
      if (header === 'Access-Control-Allow-Origin' && value === '*') {
        console.log('   ✓ CORS enabled for all origins');
      }
    }
    
    console.log('─'.repeat(50));
    
    if (allPassed) {
      console.log('\n✅ All checks passed! Server is configured for iframe embedding.');
    } else {
      console.log('\n⚠️  Some checks failed. Please review the configuration.');
    }
    
    process.exit(0);
  });

  req.on('error', (error) => {
    console.error('❌ Error connecting to server:', error.message);
    console.log('\n💡 Make sure the server is running with: npm start');
    process.exit(1);
  });

  req.end();
}, 1000);
