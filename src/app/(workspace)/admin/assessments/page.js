import AdminCollection from '@/features/management/components/admin-collection';
import AssessmentAccessReviews from '@/features/database/assessment-access';
export default function Page() {
  return (
    <>
      <AssessmentAccessReviews />
      <AdminCollection entity="assessments" />
    </>
  );
}
