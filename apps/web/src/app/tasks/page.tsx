import { Suspense } from "react"

import TasksClient from "./TasksClient"

export default function TasksPage() {
  return (
    <Suspense>
      <TasksClient />
    </Suspense>
  )
}
