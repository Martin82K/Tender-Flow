export type {
  Task,
  TaskCreateInput,
  TaskUpdateInput,
  TaskFilter,
  TaskPriority,
  TaskRelatedEntity,
  TaskRelatedEntityType,
  TaskExternalProvider,
  TaskSyncStatus,
  TodoProject,
  TodoProjectCreateInput,
  TodoProjectUpdateInput,
} from "./types";

export { useTasksQuery, TASK_KEYS } from "./hooks/useTasksQuery";
export { useTaskProjectsQuery, TODO_PROJECT_KEYS } from "./hooks/useTaskProjectsQuery";
export {
  useCreateTaskMutation,
  useUpdateTaskMutation,
  useDeleteTaskMutation,
  useToggleTaskMutation,
} from "./hooks/useTaskMutations";
export {
  useCreateTodoProjectMutation,
  useUpdateTodoProjectMutation,
  useDeleteTodoProjectMutation,
} from "./hooks/useTaskProjectMutations";
export {
  createTodoProject,
  deleteTodoProject,
  listTodoProjects,
  updateTodoProject,
} from "./api/taskProjectsApi";

export {
  mergeActionQueue,
  classifyTaskSeverity,
} from "./model/actionQueueMerge";
export {
  buildTaskTree,
  findTaskSelection,
  filterTaskTreeByTodoProject,
  getSubtaskProgress,
  getTodoProjectRootCount,
  isActiveRootTask,
  isSubtask,
  matchesTaskView,
} from "./model/taskTree";
export type { TaskSelection, TaskViewFilter, TaskWithSubtasks } from "./model/taskTree";
export type {
  ActionQueueItem,
  ActionQueueItemKind,
  DerivedActionQueueItem,
  TaskQueueItem,
} from "./model/actionQueueMerge";

export { TaskFormModal } from "./ui/TaskFormModal";
export { TaskQuickAdd } from "./ui/TaskQuickAdd";
export { TaskCreateButton } from "./ui/TaskCreateButton";
export { TasksPage } from "./ui/TasksPage";
