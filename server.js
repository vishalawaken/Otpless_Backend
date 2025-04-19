require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const app = express();
const PORT = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// OTPless Configuration
const OTPLESS_CLIENT_ID = process.env.OTPLESS_CLIENT_ID;
const OTPLESS_CLIENT_SECRET = process.env.OTPLESS_CLIENT_SECRET;

console.log("✅ server.js has started");

app.get('/', (req, res) => {
  console.log("🌐 GET / was hit");
  res.send('🎉 Hello from your OTPless backend server!');
});

app.post('/api/auth/otpless', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Token missing from request' });
  }

  try {
    // Verify token with OTPless API
    const verifyResponse = await fetch('https://api.otpless.com/api/v1/token/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'client-id': OTPLESS_CLIENT_ID,
        'client-secret': OTPLESS_CLIENT_SECRET
      },
      body: JSON.stringify({ token })
    });

    const verifyData = await verifyResponse.json();

    if (!verifyResponse.ok) {
      console.error('Token verification failed:', verifyData);
      return res.status(401).json({ error: 'Token verification failed' });
    }

    // Log the verified user data
    console.log('Verified user data:', verifyData);

    // Return success with user data
    res.status(200).json({
      message: 'Token verified successfully',
      userData: verifyData
    });

  } catch (error) {
    console.error('Error verifying token:', error);
    res.status(500).json({ error: 'Internal server error during verification' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server is listening on http://localhost:${PORT}`);
});
