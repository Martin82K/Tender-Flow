export type GuardedConsoleMethod = "error" | "warn";
export type ConsoleMessageMatcher = string | RegExp;

interface ExpectedConsoleCall {
  method: GuardedConsoleMethod;
  matcher: ConsoleMessageMatcher;
  expectedCount: number;
  receivedCount: number;
}

interface CapturedConsoleCall {
  method: GuardedConsoleMethod;
  message: string;
}

const formatValue = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value instanceof Error) return `${value.name}: ${value.message}`;

  try {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? String(value) : serialized;
  } catch {
    return String(value);
  }
};

const formatArguments = (args: readonly unknown[]): string =>
  args.map(formatValue).join(" ");

const matches = (matcher: ConsoleMessageMatcher, message: string): boolean => {
  if (typeof matcher === "string") return message.includes(matcher);
  matcher.lastIndex = 0;
  return matcher.test(message);
};

const describeMatcher = (matcher: ConsoleMessageMatcher): string =>
  typeof matcher === "string" ? JSON.stringify(matcher) : matcher.toString();

export interface ConsoleGuard {
  capture: (method: GuardedConsoleMethod, args: readonly unknown[]) => void;
  expect: (
    method: GuardedConsoleMethod,
    matcher: ConsoleMessageMatcher,
    count?: number,
  ) => void;
  reset: () => void;
  verify: () => void;
}

export const createConsoleGuard = (): ConsoleGuard => {
  let expectedCalls: ExpectedConsoleCall[] = [];
  let unexpectedCalls: CapturedConsoleCall[] = [];

  return {
    capture(method, args) {
      const message = formatArguments(args);
      const expectation = expectedCalls.find(
        (candidate) =>
          candidate.method === method &&
          candidate.receivedCount < candidate.expectedCount &&
          matches(candidate.matcher, message),
      );

      if (expectation) {
        expectation.receivedCount += 1;
        return;
      }

      unexpectedCalls.push({ method, message });
    },

    expect(method, matcher, count = 1) {
      if (!Number.isInteger(count) || count < 1) {
        throw new Error("Expected console call count must be a positive integer");
      }
      expectedCalls.push({
        method,
        matcher,
        expectedCount: count,
        receivedCount: 0,
      });
    },

    reset() {
      expectedCalls = [];
      unexpectedCalls = [];
    },

    verify() {
      const problems: string[] = unexpectedCalls.map(
        ({ method, message }) => `Unexpected console.${method}: ${message}`,
      );

      expectedCalls
        .filter(({ expectedCount, receivedCount }) => receivedCount !== expectedCount)
        .forEach(({ method, matcher, expectedCount, receivedCount }) => {
          problems.push(
            `Missing expected console.${method} ${describeMatcher(matcher)}: ` +
              `expected ${expectedCount}, received ${receivedCount}`,
          );
        });

      if (problems.length > 0) {
        throw new Error(problems.join("\n"));
      }
    },
  };
};

export const testConsoleGuard = createConsoleGuard();

export const expectConsoleError = (
  matcher: ConsoleMessageMatcher,
  count = 1,
): void => testConsoleGuard.expect("error", matcher, count);

export const expectConsoleWarn = (
  matcher: ConsoleMessageMatcher,
  count = 1,
): void => testConsoleGuard.expect("warn", matcher, count);
