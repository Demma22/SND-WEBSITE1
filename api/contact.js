export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, email, phone, message } = req.body;

    // Validate
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Please fill in all required fields' });
    }

    // Send email notification using Resend
    let emailSent = false;
    try {
      const RESEND_API_KEY = process.env.RESEND_API_KEY;
      
      if (RESEND_API_KEY) {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'onboarding@resend.dev',
            to: 'denisssendagire22@gmail.com',
            subject: '📬 New Contact Form Submission - SND Website',
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="UTF-8">
                <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { background: #343940; color: white; padding: 20px; text-align: center; }
                  .content { background: #f9fafb; padding: 20px; border-radius: 8px; margin-top: 20px; }
                  .field { margin-bottom: 15px; }
                  .label { font-weight: bold; color: #343940; }
                  .value { margin-top: 5px; color: #4b5563; }
                  .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #9ca3af; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h2>📬 New Message from SND Website</h2>
                  </div>
                  <div class="content">
                    <div class="field">
                      <div class="label">👤 Name:</div>
                      <div class="value">${name}</div>
                    </div>
                    <div class="field">
                      <div class="label">📧 Email:</div>
                      <div class="value"><a href="mailto:${email}">${email}</a></div>
                    </div>
                    <div class="field">
                      <div class="label">📞 Phone:</div>
                      <div class="value">${phone || 'Not provided'}</div>
                    </div>
                    <div class="field">
                      <div class="label">💬 Message:</div>
                      <div class="value">${message.replace(/\n/g, '<br>')}</div>
                    </div>
                    <div class="field">
                      <div class="label">🕐 Sent:</div>
                      <div class="value">${new Date().toLocaleString()}</div>
                    </div>
                  </div>
                  <div class="footer">
                    <p>This message was sent from your SND website contact form.</p>
                    <p>Reply directly to ${email} to respond to this inquiry.</p>
                  </div>
                </div>
              </body>
              </html>
            `
          })
        });
        
        if (response.ok) {
          emailSent = true;
          console.log('✅ Email notification sent to denisssendagire22@gmail.com');
        } else {
          console.log('⚠️ Email failed:', await response.text());
        }
      } else {
        console.log('⚠️ RESEND_API_KEY not set. Email not sent.');
      }
    } catch (emailError) {
      console.error('❌ Email error:', emailError.message);
    }

    // Log to console
    console.log('📧 New message from:', { name, email, phone, message });

    // Return success
    return res.status(200).json({ 
      success: true, 
      message: emailSent ? '✓ Message sent! You will receive a confirmation email shortly.' : '✓ Message received!',
      emailSent: emailSent
    });
    
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
}