import { createMcpResourceRuntime } from '../core/resourceRuntime.js';
import { createMcpToolRuntime } from '../core/toolRuntime.js';
import { registerChangesModule } from './changes.js';
import { registerContractsModule } from './contracts.js';
import { registerDiscoveryModule } from './discovery.js';
import { registerOutlookModule } from './outlook.js';
import { registerProjectsModule } from './projects.js';
import { registerSubcontractorsModule } from './subcontractors.js';
import { registerTasksModule } from './tasks.js';
import { registerTendersModule } from './tenders.js';

export const registerTenderFlowMcpModules = ({
  server,
  auth,
  supabase,
  includeWriteTools,
}) => {
  const tools = createMcpToolRuntime({ server, auth, supabase });
  const resources = createMcpResourceRuntime({ server, auth, supabase });
  const context = {
    auth,
    supabase,
    tools,
    resources,
    includeWriteTools,
  };

  registerDiscoveryModule(context);
  registerProjectsModule(context);
  registerTendersModule(context);
  registerContractsModule(context);
  registerSubcontractorsModule(context);
  registerTasksModule(context);
  registerOutlookModule(context);
  registerChangesModule(context);
};
