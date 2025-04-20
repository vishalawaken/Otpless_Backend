# OTPless Shopify Integration Backend

This backend service provides a connection between OTPless login and Shopify customer accounts.

## How It Works

1. The frontend calls OTPless for authentication
2. OTPless verifies the user and returns a token
3. The frontend sends this token to our backend
4. Our backend verifies the token with OTPless
5. Our backend creates/gets the Shopify customer account
6. The customer is logged into Shopify

## Setup Instructions

### 1. Environment Variables

Fill in the `.env` file with your credentials:

```
# OTPless Configuration
OTPLESS_CLIENT_ID=your_otpless_client_id
OTPLESS_CLIENT_SECRET=your_otpless_client_secret

# Shopify Configuration
SHOPIFY_STORE_URL=https://your-store.myshopify.com
SHOPIFY_API_KEY=your_shopify_api_key
SHOPIFY_API_SECRET=your_shopify_api_secret
SHOPIFY_API_VERSION=2023-10
SHOPIFY_ACCESS_TOKEN=your_shopify_access_token

# Optional for Shopify Plus
# SHOPIFY_MULTIPASS_SECRET=your_multipass_secret

# Port configuration
PORT=3000
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run the Server

```bash
npm start
```

## Creating a Shopify Private App

To get the required Shopify API credentials:

1. Go to your Shopify admin
2. Navigate to Apps > Develop apps
3. Click "Create an app"
4. Name it "OTPless Integration"
5. Under "Admin API access", add the following permissions:
   - `read_customers`
   - `write_customers`
6. Click "Install app"
7. After installation, you'll be provided with an API key and secret
8. Generate an API access token with the required scopes

## Shopify Plus Multipass (Optional)

If you have Shopify Plus, you can use Multipass for a more secure customer login:

1. In your Shopify admin, go to Settings > Checkout
2. Find the Multipass section and enable it
3. Copy the Multipass secret and add it to your `.env` file

## Deployed URL

The backend is currently deployed at: `https://otpless_backend.railway.internal`

Make sure your Shopify store can access this URL.

## Troubleshooting

- **Login not working**: Check your browser console for errors, and server logs for details
- **Customer not being created**: Verify your Shopify API permissions and access token
- **OTPless verification fails**: Ensure your OTPless client ID and secret are correct

## Security Considerations

- The backend verifies OTPless tokens before creating Shopify customers
- User passwords are generated securely and not stored in the frontend
- For non-Shopify Plus stores, the system uses a standard login flow with auto-fill 