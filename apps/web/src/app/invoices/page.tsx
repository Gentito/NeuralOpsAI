import { Suspense } from "react"

import InvoicesClient from "./InvoicesClient"

export default function InvoicesPage() {
  return (
    <Suspense>
      <InvoicesClient />
    </Suspense>
  )
}
