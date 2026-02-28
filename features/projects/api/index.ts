export { projectService } from "@/services/projectService";
export * from "./pipelineApi";
export * from "./projectScheduleApi";
export * from "./tenderPlanApi";
export * from "./generateContractProtocol";
export {
  useAddProjectMutation,
  useDeleteProjectMutation,
  useArchiveProjectMutation,
  useUpdateProjectDetailsMutation,
  useAddCategoryMutation,
  useEditCategoryMutation,
  useDeleteCategoryMutation,
} from "@/hooks/mutations/useProjectMutations";
