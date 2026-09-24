import { EmployeeProfile } from '@/components/staff/employee/EmployeeProfile'

export default async function EmployeeProfilePage({ params }: PageProps<'/dashboard/staff/[id]'>) {
  const { id } = await params
  return <EmployeeProfile staffId={id} />
}
