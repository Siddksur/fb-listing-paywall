const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Store valid payment sessions (in production, use a database)
const validSessions = new Set();

// Middleware
app.use(express.static('public')); // Serve static files
app.use(bodyParser.json());

// Webhook endpoint - MUST be before other body parsing middleware
app.post('/stripe-webhook', bodyParser.raw({type: 'application/json'}), (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    let event;
    
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        console.log(`Webhook signature verification failed.`, err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    // Handle the checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        console.log('Payment successful for session:', session.id);
        
        // Store the session ID as valid for 1 hour
        validSessions.add(session.id);
        setTimeout(() => {
            validSessions.delete(session.id);
            console.log('Session expired:', session.id);
        }, 3600000); // 1 hour in milliseconds
    }
    
    res.json({received: true});
});

// API endpoint to verify payment
app.get('/verify-payment/:sessionId', (req, res) => {
    const sessionId = req.params.sessionId;
    
    if (validSessions.has(sessionId)) {
        res.json({ valid: true });
    } else {
        res.json({ valid: false });
    }
});

// Serve the landing page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve the form page
app.get('/form', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'form.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
