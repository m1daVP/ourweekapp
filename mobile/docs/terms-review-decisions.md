# Terms review decisions and internal draft

**Prepared:** 2026-09-17
**Publication status:** Internal working document. It is not approved legal copy
and must not be copied to the mobile or landing terms until the decisions and
legal review below are complete.

## Source-verified product facts

| Topic                  | What source supports                                                                                                                                                     | What source does not establish                                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accounts               | Email/password and optional Google sign-in; no date-of-birth, age, guardian or legal-terms field in `src/pages/SignUpPage.vue` or `API/src/modules/auth/auth.schema.ts`. | Minimum account age, parental authorisation, or acceptance record.                                                                                                   |
| Household participants | Profiles can be `adult`, `child` or `other`; a profile is distinct from an auth user. Invitations can offer access to eligible non-current participants.                 | Whether every child profile is guardian-controlled, which profiles can log in, or eligibility rules.                                                                 |
| Subscription           | Native RevenueCat purchase/restore/customer-centre flow; fallback Google Play/App Store management URLs; backend active/expired/grace-period states.                     | Production stores/products/price, automatic renewal, trials, grace/billing-retry configuration, refunds or provider deployment. Fallback prices say `Price pending`. |
| Cancellation/deletion  | Store subscription management is separate from account deletion.                                                                                                         | Reviewed refund/withdrawal procedure or legally compliant retention deadline.                                                                                        |
| Notice/change channels | In-app and website legal pages plus support email exist.                                                                                                                 | Material-change notice process, notice period, price-change/discontinuation procedure or remedy.                                                                     |

## Decisions required before publication

1. **Product owner:** choose the age/guardian approach and which participant profiles, if any, can have independent accounts. Do not collect dates of birth merely to compensate for a missing policy.
2. **Product + billing owners:** confirm Android/iOS availability, offer price/interval/renewal/trial/grace behavior, cancellation route, expiry and refund routing from configured stores/RevenueCat.
3. **Product + legal:** define a usable notice channel and procedure for material adverse changes, price changes, suspension, termination and discontinuation, including security/emergency exceptions.
4. **Legal reviewer:** approve withdrawal/digital-service remedies, complaint handling, availability wording, mandatory residence-country protections, and household/child/third-party data treatment.
5. **Privacy/operations owner:** resolve irreversible deletion versus an explicitly disclosed restoration grace period; current API behavior is soft deletion plus restoration, not erasure.

## Internal clause draft for legal review

The clauses below deliberately avoid unsupported price, age, refund, retention and
notice promises. Replace bracketed decisions only after documented owner evidence
and legal approval.

### Eligibility and household participants

> Account eligibility and any guardian requirements are governed by the
> published [approved age/guardian rule]. A participant profile used to organise
> a household is not automatically an independent OurWeek login account. Before
> adding another person's information or inviting them to a household, make sure
> that you have the authority to do so and use shared content with respect for
> that person's privacy and rights.

### Subscriptions and payments

> Available subscriptions, current price, billing interval, renewal terms and
> any trial are shown by the relevant app store before purchase. You can manage
> future renewal through [approved management route]. Deleting an OurWeek account
> does not cancel a subscription bought through an app store.

> App-store payment and refund procedures do not limit mandatory consumer rights
> that apply to you. You may also have rights concerning withdrawal from a
> distance contract and remedies if the service does not meet legal requirements.
> Contact us at ourweekapp@gmail.com for service complaints.

The legal reviewer must add the applicable pre-contract information, withdrawal
process and time limits; the safeguard alone is not a complete consumer-rights
notice.

### Service changes, suspension and termination

> We may change a feature only for [approved legitimate reasons]. For a material
> adverse change to a paid service, we will use [approved notice channel and
> timing] and provide any cancellation or remedy required by applicable law. We
> may suspend or end access when reasonably necessary to protect users or the
> service, comply with law, or address a material breach, subject to required
> notice and review.

### Privacy, export and deletion

> Our Privacy Policy explains shared-household visibility, exports and account
> deletion. Subscription cancellation remains separate from account deletion.
> Do not add a numerical deletion or backup promise here unless the approved
> retention lifecycle can meet it; a single approved privacy-policy reference is
> preferable to duplicated inconsistent timelines.

## Publication checklist

- [ ] Legal reviewer approves the clauses and mandatory consumer information.
- [ ] Product/billing owners provide dated store and notice-process evidence.
- [ ] Approved text is applied consistently to `src/features/legal/productionLegalContent.ts` and `LANDING/src/pages/terms.astro`.
- [ ] A content test asserts approved `Eligibility and household participants` and `Consumer rights and complaints` headings.
- [ ] Signed-out signup/paywall access and public links are tested; canonical English and localized action labels remain intentional.
- [ ] Effective date/version is recorded only for the approved release.
