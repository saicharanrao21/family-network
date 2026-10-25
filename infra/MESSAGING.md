# Messaging & Login Architecture

## Login methods
- Email + password
- Email magic/verification link (optional)
- Phone OTP via SMS
- WhatsApp OTP via official provider where available
- Google Sign-In
- Apple Sign-In

## Transactional messaging
- Verification
- Login OTP
- Password/account recovery
- Family invitation
- Relationship confirmation request
- Identity-match review
- Subscription receipt/renewal/failure
- Security alerts

## Important boundary
The product does not automatically synchronize a user's private SMS, email inbox or WhatsApp chat history. Those are separate systems. We use official provider APIs for authentication and transactional messages. Any future inbox import must be an explicit opt-in feature with provider-specific permissions and privacy controls.
