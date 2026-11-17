# Founder-approved multi-platform payment strategy

Recorded 2026-11-17 from the owner's Payment Strategy Addendum. Policy approval
is not provider activation, commercial price approval or verified current terms.
All live payments and external payment promotions remain disabled. No paid
infrastructure, provider account, webhook/server or checkout is introduced.

## Channel and rule model

Prepare provider-independent membership for Google Play Billing, Apple App Store /
StoreKit, Patreon Web, AI Memory's first-party website and future approved providers.
The aim is sustainable net margins and competitive prices, passing an affordable
portion of commission savings to customers. Do not delay Notebook/P0 work for
payment infrastructure. No payment SDK or entitlement backend is needed now.

Future financial rule records must be versioned, immutable once used in a quote,
and configurable by provider, channel, verified storefront/region, currency,
effective interval, product/renewal eligibility, fee basis and rounding rules.
Retain the rule version with each calculation. Unknown eligibility/fees yield an
incomplete calculation, never an assumed zero fee or live promotion. Monetary
amounts use exact minor units and explicit currency, not binary floating-point
accounting. Prices are independently configurable per legally permitted channel;
never automatically change a live price.

## Supplied reference inputs — not verified provider terms

These are the founder's provisional calculation references. They are not permanent
application constants, a cost quote, legal advice or a release-compliance claim.
Current official terms must be verified before provider implementation or commercial
activation, including eligibility, region, fee basis and whether fees combine.

| Channel | Provisional reference inputs supplied by founder |
| --- | --- |
| Google Play | Recurring subscriptions 15%; alternative billing subject to regional conditions |
| Apple App Store | Small Business 15% when eligible; standard first year 30%; eligible subscriptions after one year 15%; external purchase fees region-specific; developer membership USD 99/year |
| Patreon Web | Platform 10%; standard USD card processing 2.9% + USD 0.30; FX 2.5% when applicable; payout and other payment-method fees variable |
| Patreon iOS | Applicable Apple in-app purchase commission, Patreon platform commission and other applicable fees; verify the actual combined fee basis before calculation |
| First-party website | Configurable percentage/fixed processing, recurring billing, international, FX and payout fees; no provider selected |

Illustrative monthly prices: Apple USD 14.99; Google Play USD 12.99; Patreon Web
USD 11.99; website USD 9.99. **These are examples, not approved prices.** All final
prices, discounts and promotions require explicit founder approval. Sustainable
web/Patreon discounts must respect current storefront and consumer requirements.

## True-cost and settlement worksheet

For every rule version/channel/currency distinguish gross subscription revenue;
platform commissions; percentage processing and fixed transaction charges; FX and
international charges; taxes/VAT; refunds; chargebacks; payout fees; infrastructure;
AI; customer acquisition; then net contribution margin. Record which fees apply
to which base and timing. Do not add percentages blindly or double-count VAT/fees.
Record actual settlement date, reserves/holds and available operating cash apart
from recognized or pending revenue. Pending store payouts are never cash.

Use the [financial policy](financial-policy.md) scenarios without conflating users:

| Registered | Example monthly active (20%) | Example paid (5%) |
| ---: | ---: | ---: |
| 100 | 20 | 5 |
| 1,000 | 200 | 50 |
| 10,000 | 2,000 | 500 |
| 100,000 | 20,000 | 5,000 |
| 1,000,000 | 200,000 | 50,000 |

These ratios are synthetic planning assumptions, not forecasts. At each scale
model the channel mix and price × paid users, each cost category, delayed/failed
settlements, mass refunds, chargebacks, FX movement, acquisition expense and
100%-active/10× usage stress. Calculate scenario margins and actual cash runway
only with verified rule inputs. Unspecified taxes/provider costs remain unknown;
no invented net-profit figures or assumed eligibility. Paid AI remains off
regardless of subscriber count. Preserve the 90-day reserve and eight financial
activation gates, including actual settled funds and explicit founder approval.

## Regional external-payment admission

Independently verify United States, European Union, Türkiye, United Kingdom,
Japan, South Korea and each other supported market against current official
Apple/Google rules, program eligibility, app type, storefront and contractual terms.
Use verified storefront information; IP address or GPS alone cannot authorize a
purchase path. Unknown/prohibited status disables links, discounted web offers
and in-app price comparisons. Never bypass platform payment rules. Compliant
external marketing may be prepared only with the applicable reviews/approval.
No regional permission, fee exception or external-link eligibility is asserted here.

## Unified entitlements — future implementation requirements

Long-term: one AI Memory account across Android, iOS and Web where legally
permitted, while core local use remains account-independent. Verify user identity
and purchase ownership; validate receipts server-side and payment events via
signed verified webhooks. Process renewal, cancellation, refunds, chargebacks,
grace periods, expiry and purchase restoration idempotently. Prevent replay and
duplicate grants, and synchronize cross-platform entitlements with secure account
linking. Never grant premium from client-only claims or collect account passwords.

Detect overlapping benefits before purchase so users do not accidentally pay
twice. Do not automatically cancel an existing provider subscription when switching.
Preserve benefits already paid for and make cancellation information easy to find.
Do not remove existing features to force upgrades or add hidden fees. Where
sustainable, offer new functionality to existing subscribers without immediate
price increases. No raw card data storage: future checkout must use approved
hosted checkout or secure tokenization, with independent security review.

## First-party provider evaluation — no selection or activation

Compare iyzico, PayTR, Stripe, Paddle and other legally available candidates only
in a separately scoped evaluation. Do not assume Turkish-company eligibility.
Record total effective commission, fixed monthly/transaction costs, supported
company jurisdictions and Turkish-company eligibility, international/recurring
support, currencies, settlement periods, tax responsibilities, Merchant of Record
capabilities, refunds/chargebacks, security and integration complexity. Prefer a
secure financially efficient first-party experience when feasible. Final provider
choice and every financial obligation require founder approval.

## Disabled status and next decision

All payment providers, checkout, billing webhooks, live entitlements and external
payment promotion are inactive. This documentation adds no service cost. Next
payment work is evidence-backed cost/eligibility evaluation after the product's
critical foundation is stable; implementation/activation remains subject to the
financial, regional, security and founder gates. No account/purchase is required
to prepare the Notebook milestone.
