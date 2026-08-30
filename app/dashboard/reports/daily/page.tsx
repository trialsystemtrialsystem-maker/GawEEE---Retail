import { redirect } from 'next/navigation'

// The daily report already lives on the financial dashboard overview.
export default function DailyReportRedirect() {
  redirect('/dashboard/financial')
}
