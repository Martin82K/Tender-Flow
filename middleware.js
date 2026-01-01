// Middleware for Railway deployment to allow iframe embedding
export default function handler(req, res) {
  // Set headers to allow iframe embedding
  res.setHeader('X-Frame-Options', 'ALLOWALL');
  res.setHeader('Content-Security-Policy', "frame-ancestors *");
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Continue to next middleware
  return res.status(200).json({ status: 'ok' });
}
