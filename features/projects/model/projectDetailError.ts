export class ProjectUnavailableError extends Error {
  constructor() {
    super("Projekt není dostupný.");
    this.name = "ProjectUnavailableError";
  }
}
