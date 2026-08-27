export type LegalSection = Readonly<{
  heading: string;
  paragraphs: readonly string[];
}>;

export type LegalDocument = Readonly<{
  title: string;
  effectiveDate: string;
  intro: string;
  sections: readonly LegalSection[];
}>;

export const PUBLIC_LEGAL_URLS = {
  privacy: 'https://ourweekapp.com/privacy',
  terms: 'https://ourweekapp.com/terms',
  deleteAccount: 'https://ourweekapp.com/delete-account',
} as const;

const operatorDetails =
  'VADYM PASICHNYK - WebWave, ul. Hugo Kołłątaja 6, lok. 3, 20-006 Lublin, Poland; NIP 5273152349; REGON 540935095.';

export const privacyPolicy: LegalDocument = {
  title: 'Privacy Policy',
  effectiveDate: 'Effective date: August 27, 2026',
  intro:
    'This Privacy Policy explains how OurWeek handles personal data when you use the OurWeek mobile app or our website.',
  sections: [
    {
      heading: 'Controller and contact',
      paragraphs: [
        `${operatorDetails} This business is the controller of personal data processed for OurWeek.`,
        'For privacy questions or requests, contact us at ourweekapp@gmail.com.',
      ],
    },
    {
      heading: 'Scope',
      paragraphs: [
        'This policy applies to the OurWeek mobile app, our website, support communications, and any optional integrations you choose to connect. It does not replace the privacy information provided by an app store, Google, RevenueCat, OpenAI, Sentry, or another independent provider.',
      ],
    },
    {
      heading: 'Data we process',
      paragraphs: [
        'We process account and authentication data, such as your email address, display name, account identifiers, and session information. We also process household membership and participant information, meeting notes, topics, tasks, agreements, and other content you choose to add or share in OurWeek.',
        'If you use an account export, we process the request and prepare the data associated with your account. If you contact support, we process the information included in your message and the information needed to respond.',
        'When you use a paid subscription, app stores and, where enabled, RevenueCat handle purchase processing. We may receive subscription-entitlement and transaction-related information needed to provide subscription access; we do not collect payment-card details directly.',
      ],
    },
    {
      heading: 'Why we process data',
      paragraphs: [
        'We process data to provide and maintain OurWeek, authenticate users, save and synchronize shared household content when sync is enabled, provide support, prevent misuse, comply with legal obligations, and improve reliability.',
        'Depending on the context, we process data to perform our contract with you, comply with legal obligations, pursue legitimate interests such as security and service reliability, or with your consent where that is required.',
      ],
    },
    {
      heading: 'Where data is processed and shared',
      paragraphs: [
        'OurWeek uses backend and hosting services, including Supabase where account sync is enabled, to provide authenticated and synchronized features. Authorised members of a shared household can see the household content that is shared with them.',
        'Optional providers are used only when the relevant feature is enabled or you choose to use it: Google Play and RevenueCat for subscription entitlement handling, Sentry for diagnostics, OpenAI for AI-generated summaries, and Google Calendar for calendar connections. We share only the data needed for the relevant feature.',
        'Some providers may process data outside the European Economic Area. Where required, those transfers are made using the safeguards available under applicable data-protection law, such as adequacy decisions or standard contractual clauses.',
      ],
    },
    {
      heading: 'Local device data',
      paragraphs: [
        'Private notes are designed to remain on your device and are not included in shared household content or account sync. Local reminder settings and notification schedules are also stored and used on your device. You can manage notification permissions through your device settings.',
        'Deleting the app or clearing device storage may remove local-only information. Export and account-deletion requests cannot recover local-only data that is no longer present on the device.',
      ],
    },
    {
      heading: 'Retention and deletion',
      paragraphs: [
        'We keep personal data only for as long as needed to provide OurWeek, meet legal obligations, resolve disputes, and enforce agreements. You can request an export from the app and delete your account in the app when signed in.',
        `If you cannot sign in, request deletion at ${PUBLIC_LEGAL_URLS.deleteAccount} or email ourweekapp@gmail.com from your account address. After we verify the request, we delete or anonymize account data within 30 days. Backup copies expire within 90 days.`,
        'Deleting an account may affect shared household content. If another eligible member remains, shared household records may remain available to that household; subscriptions must be cancelled through the relevant app store.',
      ],
    },
    {
      heading: 'Your rights',
      paragraphs: [
        'Subject to applicable law, you may request access to, correction of, deletion of, restriction of, or portability of your personal data, and object to certain processing. Where processing relies on consent, you may withdraw consent at any time without affecting earlier processing.',
        'To exercise these rights, email ourweekapp@gmail.com. You may also lodge a complaint with the Polish supervisory authority, the President of the Personal Data Protection Office (UODO), or another competent data-protection authority.',
      ],
    },
    {
      heading: 'Changes and contact',
      paragraphs: [
        'We may update this policy when OurWeek or applicable law changes. We will publish the updated version with a new effective date. Questions about this policy can be sent to ourweekapp@gmail.com.',
      ],
    },
  ],
};

export const termsOfService: LegalDocument = {
  title: 'Terms of Service',
  effectiveDate: 'Effective date: August 27, 2026',
  intro:
    'These Terms of Service govern your use of the OurWeek mobile app and website.',
  sections: [
    {
      heading: 'Who provides OurWeek',
      paragraphs: [
        `OurWeek is provided by ${operatorDetails}`,
        'You can contact us at ourweekapp@gmail.com. By using OurWeek, you agree to these terms and the Privacy Policy.',
      ],
    },
    {
      heading: 'The service',
      paragraphs: [
        'OurWeek is a guided weekly meeting app for couples and families. It helps households discuss topics, record notes, create tasks and agreements, and review follow-ups.',
        'Features may differ by device, app version, region, plan, or whether an optional integration is enabled. We may update, improve, or discontinue features where reasonably necessary.',
      ],
    },
    {
      heading: 'Accounts and shared household content',
      paragraphs: [
        'You must provide accurate account information and keep access to your account secure. Do not share your password or use another person’s account without permission.',
        'Household members who are granted access can view and contribute to shared household content. You are responsible for ensuring that you have the right to add content and personal information about other people, and for using shared features respectfully.',
      ],
    },
    {
      heading: 'Acceptable use',
      paragraphs: [
        'Do not use OurWeek unlawfully, to harass or harm others, to upload content that infringes rights, to interfere with the service, to attempt unauthorized access, or to misuse automated tools against the service.',
      ],
    },
    {
      heading: 'Subscriptions and payments',
      paragraphs: [
        'Some features may require a paid subscription. Subscriptions are purchased, cancelled, and refunded through the relevant app store under its terms. Prices, billing periods, renewal, and eligibility are shown by the app store before purchase.',
        'Deleting an OurWeek account does not cancel an app-store subscription. You must manage or cancel the subscription through the relevant app store.',
      ],
    },
    {
      heading: 'AI and calendar features',
      paragraphs: [
        'AI summaries and calendar connections are optional features and may not be available in every release. AI output can be incomplete or inaccurate, so review it before relying on it. Do not submit information you are not permitted to share.',
        'If you connect a calendar, you are responsible for the permissions you grant and for reviewing the information created or synchronized through that connection.',
      ],
    },
    {
      heading: 'No professional or emergency advice',
      paragraphs: [
        'OurWeek is not therapy and does not provide medical, mental-health, legal, financial, or emergency advice. If you need urgent help or are in danger, contact local emergency services or a qualified professional.',
      ],
    },
    {
      heading: 'Availability and changes',
      paragraphs: [
        'We aim to keep OurWeek available and reliable, but the service may be interrupted for maintenance, updates, third-party outages, or circumstances beyond our reasonable control. To the extent permitted by law, we do not guarantee uninterrupted or error-free operation.',
      ],
    },
    {
      heading: 'Termination',
      paragraphs: [
        `You may stop using OurWeek at any time and can request account deletion in the app or through ${PUBLIC_LEGAL_URLS.deleteAccount}. We may suspend or end access when reasonably necessary to protect users, comply with law, or address a material breach of these terms.`,
        'After a verified deletion request, account data is deleted or anonymized within 30 days and backup copies expire within 90 days, as described in the Privacy Policy.',
      ],
    },
    {
      heading: 'Governing law',
      paragraphs: [
        'These terms are governed by the laws of Poland, except where mandatory consumer-protection law in your country of residence provides otherwise.',
      ],
    },
    {
      heading: 'Contact',
      paragraphs: [
        'For questions, complaints, or support, email ourweekapp@gmail.com.',
      ],
    },
  ],
};
