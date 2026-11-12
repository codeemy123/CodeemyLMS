import PolicyPage from '@/components/legal/policy-page';
export const metadata = {
  title: 'Terms & Conditions | CodeEmy Technologies',
  description:
    'Account access, learning content, assessment and acceptable-use terms for CodeEmy LMS.',
};
const sections = [
  {
    title: 'About these terms',
    paragraphs: [
      'These terms describe the use of the CodeEmy Technologies learning management portal by Students, Mentors and Administrators. Review them before creating an account or using academy services. Contact CodeEmy if you need clarification. Separate written course or enrollment terms may also apply; these portal terms do not replace statutory consumer rights.',
    ],
  },
  {
    title: 'Accounts and academy approval',
    paragraphs: [
      'Provide accurate details and use your own email or Google account. Student and Mentor registrations require Administrator review before workspace access is activated. Approval, course access and batch membership are managed by the academy; selecting a role does not grant unrestricted access.',
      'Keep your credentials private. Do not share accounts, impersonate another learner or attempt to access another role, batch, submission or private file. Report suspected misuse promptly. If you are under 18, ask your parent or guardian to contact the academy before registering so appropriate enrollment arrangements can be confirmed.',
    ],
  },
  {
    title: 'Courses, classes and recordings',
    paragraphs: [
      'Use only the courses, materials and classes assigned to your account. Course schedules and availability are communicated by the academy. A meeting link is for authorized participants and must not be publicly shared.',
      'Classes may be recorded when the academy announces recording. Published recordings are intended for authorized learners in the relevant course or batch. Do not redistribute recordings, expose other participants’ personal information or publish class content without permission. Ask the academy about recording before participating if you have concerns.',
    ],
  },
  {
    title: 'Assessments and assignment rules',
    paragraphs: [
      'Assessments may have a scheduled access window, a server-enforced duration and one permitted attempt. Read the on-screen instructions before starting. Time expiry, leaving the assessment, a tab visibility change or leaving fullscreen can submit and lock the attempt. Browser checks have technical limits and do not guarantee detection of every device action.',
      'To request another assessment attempt, submit your reason through the assessment access request. Only an Administrator may approve a new access window; approval is not automatic. Previous attempts and marks remain part of the academic record.',
      'Assignments follow their displayed deadline and one-submission rule. Submit your own work, check attachments before submitting and do not copy, impersonate, manipulate scores or use assistance prohibited by your instructor. Contact the academy promptly about technical problems.',
    ],
  },
  {
    title: 'Uploads, content and acceptable use',
    paragraphs: [
      'Upload only material you own or have permission to use. You retain your rights in your submissions and permit the academy to store, display to authorized staff and evaluate them for delivering the course.',
      'Do not upload malware, unlawful content, abusive material, confidential third-party information or material that infringes intellectual property. Do not scrape private data, bypass access controls or interfere with the service. CodeEmy course materials, branding and recordings may not be sold, republished or redistributed without permission.',
    ],
  },
  {
    title: 'Results, certificates and fees',
    paragraphs: [
      'Marks, feedback, attendance and certificate eligibility are determined by the academy. Certificates may be corrected, revoked or reissued by authorized Administrators. Portal access does not itself guarantee certification, employment or placement.',
      'Course fees, cancellations and refunds depend on the written enrollment terms supplied for the specific course. Ask the academy for those terms before paying. This portal page does not establish a new refund schedule or waive any rights available under applicable law.',
    ],
  },
  {
    title: 'Service issues and account restrictions',
    paragraphs: [
      'Maintenance, connectivity and third-party service interruptions can affect availability. Keep a copy of important submitted work and contact support about an interrupted class or assessment. Do not assume an unsaved local preview has been submitted.',
      'Administrators may restrict access to protect account security, enforce course eligibility or investigate misuse. Contact CodeEmy to ask for review or explain a disputed restriction. These terms do not exclude obligations or liability that cannot lawfully be excluded.',
    ],
  },
  {
    title: 'Policy updates',
    paragraphs: [
      'CodeEmy may update these terms as its services change. The updated date will appear on this page. Material changes should be communicated through appropriate academy channels. Read the Privacy Policy for information about personal data.',
    ],
  },
];
export default function TermsPage() {
  return (
    <PolicyPage
      title="Terms & Conditions"
      intro="Clear rules for a safe, fair and focused learning experience."
      sections={sections}
    />
  );
}
