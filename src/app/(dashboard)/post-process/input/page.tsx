import { PostProductionInputWorkspace } from '@/components/post-process/post-production-input-workspace'
import { fetchPostProcessPageData } from '@/lib/post-process/repository'

export default async function PostProcessInputPage() {
  const result = await fetchPostProcessPageData()
  return <PostProductionInputWorkspace result={result} />
}
