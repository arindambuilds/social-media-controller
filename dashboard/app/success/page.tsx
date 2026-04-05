"use client"

import { useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import Link from "next/link"

function SuccessContent() {
  const searchParams = useSearchParams()
  const [paymentId, setPaymentId] = useState<string | null>(null)

  useEffect(() => {
    const rzpPaymentId = searchParams?.get("razorpay_payment_id") ?? null
    if (rzpPaymentId) {
      setPaymentId(rzpPaymentId)
    }
  }, [searchParams])

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", padding: 24, background: "#050608"
    }}>
      <div style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 16, padding: "48px 40px",
        textAlign: "center", maxWidth: 440, width: "100%"
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
        <h1 style={{
          color: "white", fontSize: 22, fontWeight: 700, marginBottom: 8
        }}>
          Payment successful!
        </h1>
        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 14, marginBottom: 24 }}>
          Your Pioneer plan is now active. Welcome to PulseOS.
        </p>
        {paymentId && (
          <p style={{
            color: "rgba(255,255,255,0.3)", fontSize: 11,
            fontFamily: "monospace", marginBottom: 24
          }}>
            Payment ID: {paymentId}
          </p>
        )}
        <Link href="/dashboard" style={{
          display: "inline-block", background: "#C8A951",
          color: "#0D1B3E", padding: "10px 28px",
          borderRadius: 8, fontWeight: 600, fontSize: 14,
          textDecoration: "none"
        }}>
          Go to dashboard →
        </Link>
      </div>
    </div>
  )
}

export default function SuccessPage() {
  return (
    <Suspense>
      <SuccessContent />
    </Suspense>
  )
}

