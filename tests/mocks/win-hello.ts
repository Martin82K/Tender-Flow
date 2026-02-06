type WinHelloApi = {
  isHelloAvailable: () => Promise<boolean>;
  requestHello: (message?: string, windowHandle?: Buffer) => Promise<string>;
};

const createWinHello = (): WinHelloApi => ({
  isHelloAvailable: async () => false,
  requestHello: async () => 'unavailable',
});

export default createWinHello;
