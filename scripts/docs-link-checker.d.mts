export interface DocumentationLinkFinding {
  source: string;
  target: string;
}

export function validateDocumentation(rootDirectory: string): DocumentationLinkFinding[];
