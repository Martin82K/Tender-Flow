export { projectService } from "@/services/projectService";
export * from "./pipelineApi";
export * from "./projectCloneApi";
export * from "./projectScheduleApi";
export * from "./tenderPlanApi";
export * from "./generateContractProtocol";
export {
  useAddProjectMutation,
  useCloneTenderToRealizationMutation,
  useDeleteProjectMutation,
  useArchiveProjectMutation,
  useUpdateProjectDetailsMutation,
  useAddCategoryMutation,
  useEditCategoryMutation,
  useDeleteCategoryMutation,
} from "@/hooks/mutations/useProjectMutations";
