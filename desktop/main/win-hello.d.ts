declare module 'win-hello' {
    type WinHelloApi = {
        isHelloAvailable: () => Promise<boolean>;
        requestHello: (message?: string, windowHandle?: Buffer) => Promise<string>;
    };

    const createWinHello: () => WinHelloApi;
    export default createWinHello;
}
