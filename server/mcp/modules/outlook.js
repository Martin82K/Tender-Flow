import * as z from 'zod/v4';
import { linkOutlookMessage, matchOutlookReply } from '../data.js';
import { toolResultSchema } from '../core/schemas.js';

const outlookIdentifierSchema = z.string().trim().min(1).max(2048);

const linkOutlookMessageSchema = z.object({
  bidId: z.string().trim().min(1).max(100),
  outlookImmutableId: outlookIdentifierSchema,
  internetMessageId: outlookIdentifierSchema.optional(),
  conversationId: outlookIdentifierSchema.optional(),
});

const matchOutlookReplySchema = z.object({
  outlookImmutableId: outlookIdentifierSchema.optional(),
  internetMessageId: outlookIdentifierSchema.optional(),
  inReplyToInternetMessageId: outlookIdentifierSchema.optional(),
  conversationId: outlookIdentifierSchema.optional(),
}).refine(
  (value) => Boolean(
    value.outlookImmutableId
      || value.internetMessageId
      || value.inReplyToInternetMessageId
      || value.conversationId
  ),
  { message: 'At least one Outlook message identifier is required.' },
);

export const registerOutlookModule = ({ supabase, tools, includeWriteTools }) => {
  tools.register(
    'tf_match_outlook_reply',
    {
      title: 'Match Outlook Reply',
      description: 'Use this when an Outlook reply must be matched to an existing Tender Flow bid using immutable message, RFC message, In-Reply-To, or conversation identifiers. Read-only and does not store email content.',
      inputSchema: matchOutlookReplySchema,
      outputSchema: toolResultSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => ({ ok: true, data: await matchOutlookReply(supabase, args) }),
  );

  if (!includeWriteTools) return;

  tools.register(
    'tf_link_outlook_message',
    {
      title: 'Link Outlook Message',
      description: 'Use this after Outlook returns stable identifiers for a sent inquiry. Idempotently links the message to one writable Tender Flow bid without changing its status or price.',
      inputSchema: linkOutlookMessageSchema,
      outputSchema: toolResultSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => ({ ok: true, data: await linkOutlookMessage(supabase, args) }),
    { action: 'link_outlook_message', riskLevel: 'medium' },
  );
};
