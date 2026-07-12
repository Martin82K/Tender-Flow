import type { OutgoingHttpHeaders } from 'node:http';

interface UpdaterWithRequestHeaders {
    requestHeaders: OutgoingHttpHeaders | null;
}

export const UPDATE_REQUEST_HEADERS: OutgoingHttpHeaders = {
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
};

export const applyNoCacheUpdateRequestHeaders = (updater: UpdaterWithRequestHeaders): void => {
    updater.requestHeaders = { ...UPDATE_REQUEST_HEADERS };
};
