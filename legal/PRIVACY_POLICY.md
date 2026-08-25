# Privacy Policy / Politique de confidentialité

_Last updated: <DATE>_

This Privacy Policy describes how **<APP_NAME>** ("we", "us", "our") collects, uses, and shares your personal information when you use our analytics dashboard for social media and advertising data.

---

## 1. Who we are

**<APP_NAME>** is operated by **<COMPANY_NAME>**, registered at **<COMPANY_ADDRESS>**, **<COUNTRY>**.

For any privacy-related question, contact us at **<PRIVACY_EMAIL>**.

---

## 2. What data we collect

We collect and process the following categories of data:

### 2.1 Account data
- Your **email address** (used to create your account via Supabase authentication)
- Your **encrypted password** (managed by Supabase Auth, not visible to us)
- Account creation date and last login

### 2.2 OAuth tokens (Meta + Google Ads)
When you authorize <APP_NAME> to access your Meta and/or Google Ads accounts:
- **Refresh tokens** issued by Meta and Google, used to query their APIs on your behalf
- **Customer IDs / Account IDs** (your Meta Page ID, Instagram Business ID, Google Ads Customer ID)
- These tokens are stored in our Supabase database (PostgreSQL with Row-Level Security)
- These tokens can be revoked at any time from your settings or via Meta/Google's permission pages

### 2.3 Marketing performance data (read-only)
We fetch the following data from Meta Graph API and Google Ads API to display in your dashboard:
- **Instagram (organic)** : posts metadata (caption, format, date), reach, likes, saves, comments, follower count history
- **Meta Ads (Facebook + Instagram Ads)** : campaign names, impressions, clicks, spend, CTR, CPC, statuses
- **Google Ads** : campaign names, impressions, clicks, spend, CTR, CPC, conversions, statuses

⚠ We **never** access:
- Direct messages (DM)
- Personal user data (followers identity, etc.)
- Ability to publish, modify, or delete any content on your behalf

### 2.4 Payment data (Stripe)
If you subscribe to a paid plan:
- Stripe processes your payment (we never see your card details)
- We store: subscription status (paid/free), subscription start date

### 2.5 Usage data
- Pages visited, features used (via Vercel logs, no external analytics tool)
- IP address (for security and authentication)

---

## 3. How we use your data

We use your data only to:
- Display your social media and advertising analytics in your dashboard
- Authenticate you and secure your account
- Process payments and manage your subscription
- Send essential service emails (account confirmation, subscription receipts, security alerts)
- Comply with legal obligations

We do **NOT**:
- Sell your data to third parties
- Use your data for advertising (other than your own analytics)
- Train AI models with your data
- Share your data with anyone outside the providers listed in §5

---

## 4. Legal basis (GDPR)

Under the EU General Data Protection Regulation (GDPR), our legal bases for processing your data are:
- **Contract performance** : we need your data to provide the service you subscribed to
- **Consent** : OAuth authorization to Meta/Google APIs is given by you explicitly via their consent screens
- **Legitimate interest** : security, fraud prevention, service improvement
- **Legal obligation** : tax, accounting

---

## 5. Sub-processors (third parties)

We use the following sub-processors who may process your data on our behalf:

| Provider | Purpose | Location |
|---|---|---|
| Supabase (Supabase Inc.) | Database + authentication | EU / US |
| Vercel Inc. | App hosting | US |
| Stripe (Stripe Inc.) | Payment processing | US |
| Meta (Meta Platforms, Inc.) | Source of Instagram/Meta Ads data via API | US |
| Google (Google LLC) | Source of Google Ads data via API | US |

All these providers comply with GDPR (Data Processing Addendums signed) and / or Standard Contractual Clauses for international transfers.

---

## 6. Data retention

- **Account data** : kept while your account is active. Deleted within 30 days after account closure.
- **OAuth tokens** : kept while you authorize access. Deleted when you disconnect from settings or revoke from Meta/Google.
- **Marketing data** : kept while your account is active to allow historical analysis. You can delete it at any time from your dashboard.
- **Payment data** : retained for legal accounting period (10 years in <COUNTRY>).

---

## 7. Your rights

Under GDPR, you have the right to:
- **Access** your personal data (request a copy)
- **Rectify** inaccurate data
- **Delete** your data ("right to be forgotten")
- **Restrict** processing
- **Data portability** (receive your data in a machine-readable format)
- **Object** to processing
- **Withdraw consent** at any time

To exercise these rights, contact **<PRIVACY_EMAIL>**. We will respond within 30 days.

You also have the right to lodge a complaint with your national data protection authority.

---

## 8. Security

We protect your data with:
- HTTPS encryption in transit
- Database encryption at rest (Supabase)
- Row-Level Security policies ensuring each user can only access their own data
- Regular security updates
- Multi-factor authentication option (via Supabase Auth)

No method is 100% secure, but we follow industry best practices.

---

## 9. Cookies

We use only essential cookies (session authentication). We do not use any tracking, advertising, or analytics cookies that would require additional consent.

---

## 10. Changes to this policy

We may update this Privacy Policy occasionally. Significant changes will be notified by email at least 30 days before they take effect.

---

## 11. Contact

For any question regarding this policy or to exercise your rights:
- **Email** : <PRIVACY_EMAIL>
- **Postal address** : <COMPANY_ADDRESS>
- **Data Protection Officer** : <DPO_NAME or "Not designated — see contact above">
