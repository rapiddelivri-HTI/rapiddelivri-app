const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      items,
      subtotal,
      tax,
      deliveryFee,
      platformFee,
      driverTip,
      grandTotal,
      orderType,
      restaurantName,
      customerEmail,
    } = req.body;

    // Create line items for Stripe
    const lineItems = [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Rapid Delivri Food - ${restaurantName}`,
            description: `${orderType === 'delivery' ? '🚗 Delivery' : '🏃 Pickup'} Order`,
            images: ['https://rapiddelivri.com/apple-touch-icon.png'],
          },
          unit_amount: Math.round(subtotal * 100),
        },
        quantity: 1,
      },
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Tax',
            description: 'Restaurant Tax (7%)',
          },
          unit_amount: Math.round(tax * 100),
        },
        quantity: 1,
      },
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Platform Fee',
            description: 'Rapid Delivri Platform Fee',
          },
          unit_amount: Math.round(platformFee * 100),
        },
        quantity: 1,
      },
    ];

    // Add delivery fee if applicable
    if (orderType === 'delivery' && deliveryFee > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Delivery Fee',
            description: '🚗 Driver Delivery Fee',
          },
          unit_amount: Math.round(deliveryFee * 100),
        },
        quantity: 1,
      });
    }

    // Add driver tip if applicable
    if (driverTip > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Driver Tip',
            description: '🙏 Thank you for tipping your driver!',
          },
          unit_amount: Math.round(driverTip * 100),
        },
        quantity: 1,
      });
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      customer_email: customerEmail || undefined,
      success_url: `${req.headers.origin || 'https://rapiddelivri.com'}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin || 'https://rapiddelivri.com'}?payment=cancelled`,
      metadata: {
        restaurant: restaurantName,
        order_type: orderType,
        grand_total: grandTotal.toString(),
      },
      payment_intent_data: {
        description: `Rapid Delivri Food - ${restaurantName} - ${orderType}`,
      },
    });

    return res.status(200).json({
      sessionId: session.id,
      url: session.url,
    });

  } catch (error) {
    console.error('Stripe error:', error);
    return res.status(500).json({
      error: error.message || 'Something went wrong',
    });
  }
};
