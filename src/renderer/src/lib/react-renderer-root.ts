import { createRoot, type Root } from 'react-dom/client'

type RendererRootHotData = {
  alfredRendererRoot?: Root
}

export function getOrCreateRendererRoot(
  container: HTMLElement,
  hotData?: RendererRootHotData
): Root {
  const existingRoot = hotData?.alfredRendererRoot
  if (existingRoot) {
    return existingRoot
  }
  const root = createRoot(container)
  if (hotData) {
    hotData.alfredRendererRoot = root
  }
  return root
}
