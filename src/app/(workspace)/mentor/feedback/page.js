import RecordList from '@/features/management/components/record-list';
import QueryCenter from '@/features/workflows/components/query-center';

export default function MentorFeedbackPage() {
  return (
    <>
      <QueryCenter />
      <div className="lower">
        <RecordList />
      </div>
    </>
  );
}
