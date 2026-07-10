import { redirect } from 'next/navigation'

export default function PostProcessIndexPage() {
  redirect('/post-process/input')
}
