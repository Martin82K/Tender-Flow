export const MICROSOFT_TODO_LOCAL_CHANGE_EVENT = "tender-flow:microsoft-todo-local-change";

export const notifyMicrosoftTodoLocalChange = (): void => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(MICROSOFT_TODO_LOCAL_CHANGE_EVENT));
};
