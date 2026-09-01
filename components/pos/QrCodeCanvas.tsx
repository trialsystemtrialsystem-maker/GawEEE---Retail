'use client'

import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'

// Renders the mock QRIS payload from POST /api/payments/initiate as an
// actual scannable-looking QR image, client-side — same reasoning as
// jsbarcode in PrintBarcodeManager (hand-rolling QR encoding isn't
// verifiable, so lean on a well-tested library). This is still demo/mock
// data (see that route's comment), not a real payment rail.
export function QrCodeCanvas({ data, size = 176 }: { data: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, data, { width: size, margin: 1 }).catch(() => {})
    }
  }, [data, size])

  return <canvas ref={canvasRef} width={size} height={size} className="mx-auto rounded-md" />
}
