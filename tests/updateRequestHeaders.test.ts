import { describe, expect, it } from 'vitest';

import { applyNoCacheUpdateRequestHeaders } from '../desktop/main/services/updateRequestHeaders';

describe('desktop update request headers', () => {
    it('disables cached update metadata requests', () => {
        const updater = {
            requestHeaders: null,
        };

        applyNoCacheUpdateRequestHeaders(updater);

        expect(updater.requestHeaders).toEqual({
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache',
        });
    });
});
