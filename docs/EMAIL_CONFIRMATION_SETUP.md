
# Email Confirmation Setup Guide

## Current Status

Your app is currently using Supabase's default email service, which has the following limitations:

- **Rate Limit**: 30 emails per hour
- **Deliverability**: Emails may go to spam folders
- **Restricted Recipients**: Only sends to team members unless custom SMTP is configured

## Why Emails May Not Be Received

Based on the logs, emails ARE being sent successfully from Supabase. If users aren't receiving them, it's likely due to:

1. **Spam Filters**: The default Supabase SMTP has limited reputation, so emails often end up in spam/junk folders
2. **Email Provider Blocking**: Some email providers (especially corporate ones) block emails from unknown domains
3. **Rate Limiting**: The 30 emails/hour limit can be quickly reached during testing or launches

## Solution: Set Up Custom SMTP

For production use, you MUST configure a custom SMTP provider. Here are the recommended options:

### Recommended SMTP Providers

1. **Resend** (Recommended for startups)
   - Easy setup
   - Good free tier
   - Excellent deliverability
   - [Setup Guide](https://resend.com/docs/send-with-supabase-smtp)

2. **AWS SES** (Recommended for scale)
   - Very cost-effective
   - Highly reliable
   - Requires domain verification
   - [Setup Guide](https://docs.aws.amazon.com/ses/latest/dg/send-email-smtp.html)

3. **SendGrid**
   - Popular choice
   - Good free tier
   - Easy to use
   - [Setup Guide](https://www.twilio.com/docs/sendgrid/for-developers/sending-email/getting-started-smtp)

4. **Postmark**
   - Excellent deliverability
   - Focus on transactional emails
   - [Setup Guide](https://postmarkapp.com/developer/user-guide/send-email-with-smtp)

### How to Configure Custom SMTP in Supabase

1. **Get SMTP Credentials** from your chosen provider:
   - SMTP Host (e.g., `smtp.resend.com`)
   - SMTP Port (usually `587` or `465`)
   - SMTP Username
   - SMTP Password
   - From Email Address (e.g., `noreply@surfvista.com`)

2. **Configure in Supabase Dashboard**:
   - Go to: https://supabase.com/dashboard/project/ucbilksfpnmltrkwvzft/settings/auth
   - Scroll to "SMTP Settings"
   - Enable "Enable Custom SMTP"
   - Fill in your SMTP credentials
   - Set "Sender Name" to "SurfVista"
   - Save changes

3. **Update Rate Limits**:
   - Go to: https://supabase.com/dashboard/project/ucbilksfpnmltrkwvzft/auth/rate-limits
   - Increase the email rate limit to a reasonable value (e.g., 360 emails/hour)

### Quick Setup with Resend (Recommended)

1. **Create Resend Account**:
   - Go to https://resend.com
   - Sign up for free account
   - Verify your email

2. **Get API Key**:
   - Go to API Keys section
   - Create new API key
   - Copy the key (you'll need it)

3. **Get SMTP Credentials**:
   - Go to SMTP section in Resend dashboard
   - Your credentials will be:
     - Host: `smtp.resend.com`
     - Port: `465` (SSL) or `587` (TLS)
     - Username: `resend`
     - Password: Your API key

4. **Configure Domain** (Optional but recommended):
   - Add your domain in Resend
   - Add DNS records they provide
   - Verify domain
   - Use `noreply@yourdomain.com` as sender

5. **Add to Supabase**:
   - Follow step 2 above with your Resend credentials

## Testing Email Delivery

After setting up custom SMTP:

1. **Test Signup Flow**:
   - Create a new test account
   - Check that email arrives within 1-2 minutes
   - Verify email doesn't go to spam

2. **Check Logs**:
   - Supabase Auth Logs: https://supabase.com/dashboard/project/ucbilksfpnmltrkwvzft/logs/auth-logs
   - Your SMTP Provider's Dashboard

3. **Test Different Email Providers**:
   - Gmail
   - Outlook
   - Yahoo
   - Corporate email (if applicable)

## Current App Features

The app now includes:

1. **Resend Confirmation Email**:
   - Users can request a new confirmation email if they didn't receive it
   - Accessible from the sign-in screen

2. **Better Error Messages**:
   - Clear instructions when email isn't confirmed
   - Prompts to check spam folder

3. **Spam Folder Warnings**:
   - Alerts remind users to check spam/junk folders
   - Displayed during signup and when resending emails

## Best Practices

1. **Use a Custom Domain**:
   - Emails from `noreply@surfvista.com` are more trustworthy than `noreply@mail.app.supabase.io`

2. **Configure SPF, DKIM, and DMARC**:
   - These DNS records improve email deliverability
   - Your SMTP provider will guide you through this

3. **Monitor Bounce Rates**:
   - Check your SMTP provider's dashboard regularly
   - High bounce rates can hurt your sender reputation

4. **Keep Email Content Simple**:
   - Avoid promotional content in auth emails
   - Use plain text or simple HTML
   - Include only necessary links

5. **Test Before Launch**:
   - Send test emails to various providers
   - Ask team members to test signup flow
   - Verify emails don't go to spam

## Troubleshooting

### Emails Still Going to Spam

1. Verify SPF, DKIM, and DMARC records
2. Use a custom domain
3. Warm up your sending domain (start with low volume)
4. Check your email content for spam triggers

### Users Not Receiving Emails

1. Check Supabase Auth logs for errors
2. Check SMTP provider logs
3. Verify SMTP credentials are correct
4. Check rate limits aren't being hit
5. Ask user to check spam folder
6. Try resending confirmation email

### Rate Limit Errors

1. Increase rate limits in Supabase dashboard
2. Implement CAPTCHA to prevent abuse
3. Consider implementing email queuing for high-volume periods

## Support

If you continue to have issues:

1. Check Supabase Auth logs: https://supabase.com/dashboard/project/ucbilksfpnmltrkwvzft/logs/auth-logs
2. Check your SMTP provider's support documentation
3. Contact Supabase support: https://supabase.com/dashboard/support/new
4. Review this guide: https://supabase.com/docs/guides/auth/auth-smtp

## Next Steps

1. ✅ Choose an SMTP provider (Resend recommended)
2. ✅ Get SMTP credentials
3. ✅ Configure in Supabase dashboard
4. ✅ Test email delivery
5. ✅ Update rate limits
6. ✅ Configure custom domain (optional but recommended)
7. ✅ Set up SPF/DKIM/DMARC records
8. ✅ Test with real users

Once you've set up custom SMTP, your email confirmation issues should be resolved!
