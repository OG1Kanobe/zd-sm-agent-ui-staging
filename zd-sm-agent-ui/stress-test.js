import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 10,           // 10 simultaneous users
  iterations: 10,    // Each user runs exactly once
  maxDuration: '5m', // Total time limit for the test
};

export default function () {
  // --- LOGIN ---
  const loginUrl = 'https://jrhlnlbovtwjnyctcwaj.supabase.co/auth/v1/token?grant_type=password';
  const loginPayload = JSON.stringify({
    email: "tiroally@gmail.com",
    password: "Taahir0201",
    gotrue_meta_security: {}
  });
  const loginParams = {
    headers: {
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpyaGxubGJvdnR3am55Y3Rjd2FqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2MTczMDIsImV4cCI6MjA4MzE5MzMwMn0.-C2NX59L5IYYkrj5419alAs43nc9No-BLYJx8otT2cE',
      'content-type': 'application/json;charset=UTF-8',
    },
  };

  const loginRes = http.post(loginUrl, loginPayload, loginParams);
  const authToken = loginRes.json().access_token;

  // --- 3-MINUTE ANIMATION FLOW ---
  const animateUrl = 'https://zd-sm-agent-ui-staging.vercel.app/api/n8n/animate-image';
  const animatePayload = JSON.stringify({
    sourcePostId: "67f017af-722f-47a4-9638-51a36cc299d3",
    sourceImageUrl: "https://jrhlnlbovtwjnyctcwaj.supabase.co/storage/v1/object/AI-Content/FB12012026221612.jpg",
    duration: "5"
  });
  
  const animateParams = {
    headers: {
      'authorization': `Bearer ${authToken}`,
      'content-type': 'application/json',
    },
    timeout: '240s', // 4 Minute Timeout: If the connection drops at 60s or 120s, k6 will catch it.
  };

  console.log('User starting 3-minute flow...');
  const animateRes = http.post(animateUrl, animatePayload, animateParams);
  
  check(animateRes, { 
    'Long flow completed (status 200)': (r) => r.status === 200 || r.status === 201 
  });

  if (animateRes.status !== 200) {
    console.error(`Flow failed with status: ${animateRes.status}. Check for Vercel/Gateway timeouts.`);
  }
}