import { PostProcessHistoryWorkspace } from '@/components/post-process/post-process-history-workspace'
import { fetchPostProcessProductionHistory } from '@/lib/post-process/repository'

export default async function PostProcessHistoryPage() {
  const result = await fetchPostProcessProductionHistory()
  return <PostProcessHistoryWorkspace result={result} />
}
