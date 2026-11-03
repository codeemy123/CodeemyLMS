import RecordList from '@/features/management/components/record-list';
import ResourceLibrary from '@/features/workflows/components/resource-library';

export default function StudentMaterialsPage() {
  return (
    <>
      <ResourceLibrary />
      <div className="lower">
        <RecordList />
      </div>
    </>
  );
}
