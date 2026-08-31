import { PrintBarcodeManager } from '@/components/sales/PrintBarcodeManager'

export default function PrintBarcodePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Print Barcode</h1>
      <PrintBarcodeManager />
    </div>
  )
}
