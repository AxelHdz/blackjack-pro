# Supabase Email Templates

This directory contains HTML email templates for Supabase Auth emails that match the Blackjack Pro application's dark theme and styling guidelines.

## Email Templates

The following email templates are available:

1. **confirm-signup.html** - Email confirmation when users sign up
2. **magic-link.html** - Magic link/OTP login emails
3. **reset-password.html** - Password recovery emails
4. **change-email.html** - Email change confirmation
5. **invite-user.html** - User invitation emails

## How to Update Templates in Supabase Dashboard

1. Log in to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication** → **Email Templates**
4. For each template type, click **Edit** and paste the corresponding HTML from the template files
5. Update the email subject line if needed
6. Click **Save** to apply changes

### Template Mapping

| Template File | Supabase Template Type |
|--------------|------------------------|
| `confirm-signup.html` | Confirm signup |
| `magic-link.html` | Magic Link |
| `reset-password.html` | Reset Password |
| `change-email.html` | Change Email Address |
| `invite-user.html` | Invite user |

## Styling Guidelines

The templates use a dark theme that matches the application's design system:

### Color Palette

- **Background**: `#1a1a1a` (oklch: 0.12 0.006 264) - Very dark background
- **Card/Container**: `#2e2e2e` (oklch: 0.18 0.008 264) - Slightly lighter dark
- **Text Primary**: `#f2f2f2` (oklch: 0.95 0.005 264) - Light foreground
- **Text Secondary**: `#d4d4d4` - Medium gray text
- **Text Muted**: `#8a8a8a` - Muted text
- **Text Subtle**: `#6a6a6a` - Very muted text
- **Primary Accent**: `#4a90e2` (oklch: 0.65 0.15 252) - Blue primary color
- **Border**: `#474747` (oklch: 0.28 0.008 264) - Border color
- **Card Background**: `#1f1f1f` - Dark card background

### Typography

- **Font Family**: System font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', ...`)
- **Heading 1**: 28px, bold
- **Heading 2**: 24px, bold
- **Body**: 16px, line-height 1.6
- **Small Text**: 12-14px

### Design Elements

- **Border Radius**: 12px (0.75rem)
- **Button Style**: Rounded corners, blue background with shadow
- **Card Style**: Dark background with subtle border
- **Spacing**: Consistent padding (40px for sections, 20px for mobile)

## Template Variables

Supabase provides the following template variables that can be used in the templates:

| Variable | Description |
|----------|-------------|
| `{{ .ConfirmationURL }}` | Contains the confirmation URL. Example: `https://project-ref.supabase.co/auth/v1/verify?token={{ .TokenHash }}&type=email&redirect_to=https://example.com/path` |
| `{{ .Token }}` | Contains a 6-digit One-Time-Password (OTP) that can be used instead of the confirmation URL |
| `{{ .TokenHash }}` | Contains a hashed version of the `{{ .Token }}`. Useful for constructing custom email links |
| `{{ .SiteURL }}` | Contains your application's Site URL (configured in authentication settings) |
| `{{ .RedirectTo }}` | Contains the redirect URL passed when `signUp`, `signInWithOtp`, `resetPasswordForEmail`, or `inviteUserByEmail` is called |
| `{{ .Email }}` | Contains the original email address of the user |
| `{{ .NewEmail }}` | Contains the new email address (only available in "Change Email Address" template) |
| `{{ .Data }}` | Contains metadata from `auth.users.user_metadata`. Use this to personalize the email message |

### Conditional Rendering

Supabase uses Go Templates, so you can conditionally render content:

\`\`\`html
{{ if .Token }}
  <p>Your verification code: {{ .Token }}</p>
{{ end }}
\`\`\`

## Email Client Compatibility

The templates are optimized for email clients:

- ✅ **Table-based layouts** - Ensures compatibility across email clients
- ✅ **Inline styles** - Email clients strip out `<style>` tags, so all styles are inline
- ✅ **Web-safe colors** - Uses hex colors instead of oklch for maximum compatibility
- ✅ **Responsive design** - Works on mobile and desktop
- ✅ **Accessibility** - Proper contrast ratios and semantic HTML

## Testing Recommendations

1. **Test in multiple email clients**:
   - Gmail (web, iOS, Android)
   - Outlook (web, desktop)
   - Apple Mail
   - Yahoo Mail

2. **Test on mobile devices**:
   - iOS Mail app
   - Android Gmail app

3. **Verify template variables**:
   - Ensure all `{{ .Variable }}` placeholders are replaced correctly
   - Test with actual signup/login flows

4. **Check link functionality**:
   - Verify confirmation links work correctly
   - Test redirect URLs
   - Ensure OTP codes display properly

5. **Preview before deploying**:
   - Use Supabase's preview feature in the dashboard
   - Send test emails to yourself
   - Verify styling matches your application

## Notes

- Email templates use inline styles for maximum compatibility
- Colors are converted from oklch to hex for email client support
- All templates include both button and link fallbacks
- OTP codes are conditionally displayed when available
- Security notices are included where appropriate
- Templates follow the casino/gaming aesthetic of the application

## Additional Resources

- [Supabase Email Templates Documentation](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Supabase Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks)
- [Go Template Documentation](https://pkg.go.dev/text/template)
