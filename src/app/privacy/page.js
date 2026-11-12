import PolicyPage from '@/components/legal/policy-page';
export const metadata = {
  title: 'Privacy Policy | CodeEmy Technologies',
  description:
    'How CodeEmy LMS handles account details, learning records, uploads, authentication and privacy requests.',
};
const sections = [
  {
    title: 'Information used by this LMS',
    paragraphs: [
      'CodeEmy LMS handles account information such as name, email, phone, requested role, approval status and optional profile photo. Student details may include college, department, registration number and admission timestamp; Mentor details may include qualification and expertise.',
      'Learning records include assigned courses and batches, attendance, lesson progress, assessment answers and results, assignments and project submissions, feedback, queries, certificates, career applications and in-app notifications. Security and audit records record relevant account and workflow activity. Uploads can contain information you choose to include; avoid unnecessary sensitive information.',
    ],
  },
  {
    title: 'Why information is used',
    paragraphs: [
      'Information is used to authenticate accounts, review registration requests, assign the correct workspace and batch, deliver courses, evaluate work, track progress, issue certificates, respond to queries and protect the portal from misuse. Assessment start, finish and interruption reasons help enforce attempt rules and review reopen requests.',
      'Profile photos are optional. Selecting a photo starts an upload and saves it to your account when the operation succeeds. Personal detail changes are saved when you use Save changes. A success message confirms the operation; an error or local preview does not confirm permanent storage.',
    ],
  },
  {
    title: 'Who can see your information',
    paragraphs: [
      'You can view your own account and learning records. Authorized Mentors can access relevant assigned student and course records for teaching and evaluation. Authorized Administrators manage registrations, accounts, academic operations and audit records. Learner names and scores may appear in a leaderboard for the relevant batch and assessment.',
      'Private uploaded files and published class recordings are subject to account, ownership, course or batch access checks. Do not share private links or another person’s information. The academy may disclose information where legally required or necessary to investigate abuse and protect the service.',
    ],
  },
  {
    title: 'Service providers and storage',
    paragraphs: [
      'The portal uses Google Firebase for authentication, Google Cloud for backend and database services, Cloudflare R2 for uploaded files and Netlify for website hosting. These providers process information needed to operate their services. Depending on provider settings, information may be processed in locations outside your own country.',
      'If Google sign-in is selected, Firebase verifies your Google identity; CodeEmy does not ask for your Google password. An optional CodeEmy email/password sign-in is managed through Firebase Authentication. If Zoom is used for a class, Zoom handles meeting participation and recording under the academy’s Zoom configuration and Zoom’s own policies.',
    ],
  },
  {
    title: 'Sessions and browser storage',
    paragraphs: [
      'The application uses a session cookie to keep authenticated users signed in and browser storage to remember preferences such as light or dark theme. Firebase may also store authentication state in the browser. Signing out ends the portal session; clearing browser storage can reset preferences or sign-in state.',
      'These technologies support login and normal application use. This notice does not authorize advertising tracking or unrelated marketing. Any future optional tracking should be described separately before being enabled.',
    ],
  },
  {
    title: 'Class recordings',
    paragraphs: [
      'When a class is recorded, a recording may include your display name, voice, camera video, shared screen or chat depending on meeting settings. The academy should communicate recording before the class and explain access arrangements.',
      'Only participate with content you are permitted to share. Contact the academy about recording concerns or a request involving a recording of you. Recording publication and automated Zoom transfer depend on the features actually enabled for your course.',
    ],
  },
  {
    title: 'Retention, correction and removal requests',
    paragraphs: [
      'Academic, account and audit records may be kept while needed for course delivery, account administration, certificate verification, security, disputes and applicable recordkeeping requirements. A profile-photo removal action clears the photo from the account; it does not promise immediate deletion from backups, audit records or storage systems.',
      'You can edit supported personal fields and remove your displayed profile photo. For account closure, access to your information, corrections, deletion or privacy concerns, contact CodeEmy using the address below. Requests require identity verification and may be subject to lawful retention requirements. Some services cannot continue if information needed for them is removed.',
    ],
  },
  {
    title: 'Security and younger learners',
    paragraphs: [
      'Role-based access controls, authenticated file access and provider security features are used to protect information. No online service can guarantee absolute security. Keep your credentials private and report suspected unauthorized access.',
      'If you are under 18, ask a parent or guardian to contact the academy before registering. This portal does not provide an automated parental-consent verification process; the academy must confirm appropriate arrangements before enrolling younger learners.',
    ],
  },
  {
    title: 'Changes to this notice',
    paragraphs: [
      'The date above identifies the latest version. CodeEmy should communicate material changes through appropriate academy channels and update this page when data practices change. Contact CodeEmy if the explanation does not answer your question.',
    ],
  },
];
export default function PrivacyPage() {
  return (
    <PolicyPage
      title="Privacy Policy"
      intro="What your learning workspace stores, why it is needed and how to ask for help."
      sections={sections}
    />
  );
}
