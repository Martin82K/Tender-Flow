import { invokeAuthedFunction } from "./functionsClient";

interface SendEmailParams {
    to: string | string[];
    subject: string;
    html?: string; // One of html or text is required
    text?: string;
    from?: string; // Optional override, otherwise defaults to env/system default
    cc?: string | string[];
    bcc?: string | string[];
    reply_to?: string | string[];
}

interface SendEmailResponse {
    id: string; // Resend email ID
    [key: string]: any;
}

export const emailService = {
    /**
     * Sends an email using the 'send-email' Edge Function.
     * This method is secure to use from the client-side as it relies on the
     * backend-side API key (RESEND_API_KEY) which is never exposed to the client.
    */
    sendEmail: async (params: SendEmailParams): Promise<SendEmailResponse> => {
        if (!params.html && !params.text) {
            throw new Error("Email must have either HTML or Text content.");
        }

        try {
            return await invokeAuthedFunction<SendEmailResponse>("send-email", {
                body: params
            });
        } catch (error) {
            console.error("Failed to send email:", error);
            throw error;
        }
    },

    /**
     * Helper for sending a "transactional" style notification (e.g. password reset request, but manually handled).
     * This acts as a semantic wrapper around sendEmail.
     */
    sendTransactional: async (to: string, subject: string, htmlContent: string) => {
        return emailService.sendEmail({
            to,
            subject,
            html: htmlContent
        });
    },

    /**
     * Helper for sending retention/marketing emails. 
     * Currently behaves similarly to transactional, but separated for future extensibility 
     * (e.g. adding unsubscribe links, using different sender signature).
     */
    sendMarketing: async (to: string, subject: string, htmlContent: string) => {
        return emailService.sendEmail({
            to,
            subject,
            html: htmlContent
        });
    }
};
