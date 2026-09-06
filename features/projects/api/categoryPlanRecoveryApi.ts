import { tenderPlanRepository } from '@/infra/projects/tenderPlanRepository';
import type { DemandCategory } from '@/types';

export async function synchronizeCategoryPlan(projectId: string, category: DemandCategory, isCurrent: () => boolean) {
  const plans = await tenderPlanRepository.listByProject(projectId);
  if (!isCurrent()) return;
  if (plans.some(plan => plan.categoryId === category.id)) return;
  const matching = plans.find(plan => !plan.categoryId && plan.name.trim().toLowerCase() === category.title.trim().toLowerCase());
  if (matching) {
    await tenderPlanRepository.linkUnassignedToCategory(projectId, matching.id, category.id);
    return;
  }
  // 128 bits of SHA-256 keep the deterministic ID within the existing VARCHAR(36).
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(category.id));
  const suffix = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 32);
  if (!isCurrent()) return;
  // Stable across retries, including an acknowledged-late INSERT and a page reload.
  await tenderPlanRepository.create({
    id: `tp_${suffix}`, projectId, name: category.title,
    dateFrom: category.realizationStart || null, dateTo: category.realizationEnd || null,
    categoryId: category.id,
  });
}
