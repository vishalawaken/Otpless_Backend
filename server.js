import 'dotenv/config';
import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import crypto from 'crypto';
import { body, validationResult } from 'express-validator';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());
app.use(cors({
  origin: process.env.SHOPIFY_STORE_URL || '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// OTPless Configuration
const OTPLESS_CLIENT_ID = process.env.OTPLESS_CLIENT_ID;
const OTPLESS_CLIENT_SECRET = process.env.OTPLESS_CLIENT_SECRET;

// Shopify Configuration
const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;
const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL;
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2023-10';
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN; // Private app access token

console.log("✅ server.js has started");

// Validation middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: errors.array() 
    });
  }
  next();
};

app.get('/', (req, res) => {
  console.log("🌐 GET / was hit");
  res.send('🎉 Hello from your OTPless backend server!');
});

// Verify OTPless token with validation
app.post('/api/auth/otpless', [
  body('token')
    .notEmpty()
    .withMessage('Token is required')
    .trim()
    .isString()
    .withMessage('Token must be a string'),
  validateRequest
], async (req, res) => {
  const { token } = req.body;

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

// Create or get Shopify customer with validation
app.post('/api/auth/shopify/customer', [
  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .trim()
    .isEmail()
    .withMessage('Invalid email format'),
  body('token')
    .notEmpty()
    .withMessage('Token is required')
    .trim()
    .isString()
    .withMessage('Token must be a string'),
  validateRequest
], async (req, res) => {
  const { email, token } = req.body;
  
  try {
    // Verify the token again for security
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
    
    // Check if customer exists
    const searchResponse = await fetch(`${SHOPIFY_STORE_URL}/admin/api/${SHOPIFY_API_VERSION}/customers/search.json?query=email:${encodeURIComponent(email)}`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN
      }
    });
    
    const searchData = await searchResponse.json();
    
    let customer;
    
    if (searchData.customers && searchData.customers.length > 0) {
      // Customer exists
      customer = searchData.customers[0];
      console.log('Existing customer found:', customer.id);
    } else {
      // Create new customer
      const password = crypto.randomBytes(16).toString('hex');
      const customerData = {
        customer: {
          email: email,
          first_name: verifyData.firstName || 'OTPless',
          last_name: verifyData.lastName || 'User',
          phone: verifyData.phoneNumber || '',
          verified_email: true,
          password: password,
          password_confirmation: password,
          accepts_marketing: true
        }
      };
      
      const createResponse = await fetch(`${SHOPIFY_STORE_URL}/admin/api/${SHOPIFY_API_VERSION}/customers.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN
        },
        body: JSON.stringify(customerData)
      });
      
      const createData = await createResponse.json();
      
      if (createResponse.ok) {
        customer = createData.customer;
        console.log('New customer created:', customer.id);
      } else {
        console.error('Failed to create customer:', createData);
        return res.status(500).json({ error: 'Failed to create customer account' });
      }
    }
    
    // Generate customer access token
    const multipassPayload = {
      email: customer.email,
      created_at: new Date().toISOString(),
      return_to: `${SHOPIFY_STORE_URL}/account`
    };
    
    // For Shopify Plus stores with Multipass
    if (process.env.SHOPIFY_MULTIPASS_SECRET) {
      const multipassData = generateMultipassUrl(multipassPayload, process.env.SHOPIFY_MULTIPASS_SECRET);
      return res.status(200).json({ 
        customer_id: customer.id,
        redirect_url: multipassData.url
      });
    } else {
      // For regular Shopify stores (no Multipass) - must handle login client-side
      return res.status(200).json({ 
        customer_id: customer.id,
        email: customer.email,
        password_created: true,
      });
    }
    
  } catch (error) {
    console.error('Error creating/getting Shopify customer:', error);
    res.status(500).json({ error: 'Internal server error during customer creation' });
  }
});

// Helper function for Multipass (Shopify Plus)
function generateMultipassUrl(customerData, secret) {
  const cipher = crypto.createCipheriv('aes-128-cbc', 
    crypto.createHash('sha256').update(secret).digest().slice(0, 16),
    crypto.randomBytes(16));
  
  const jsonData = JSON.stringify(customerData);
  let cipherText = cipher.update(jsonData, 'utf8', 'base64');
  cipherText += cipher.final('base64');
  
  const signature = crypto.createHmac('sha256', 
    crypto.createHash('sha256').update(secret).digest().slice(0, 16))
    .update(cipherText)
    .digest('base64');
  
  const token = Buffer.from(cipherText + '--' + signature).toString('base64');
  const url = `${SHOPIFY_STORE_URL}/account/login/multipass/${encodeURIComponent(token)}`;
  
  return { token, url };
}

app.listen(PORT, () => {
  console.log(`🚀 Server is listening on http://localhost:${PORT}`);
}); 