const STABLE_SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const PRERELEASE_SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)-/;

export const validateStableVersion = (version) => {
  if (typeof version === "string" && STABLE_SEMVER_PATTERN.test(version)) {
    return [];
  }

  if (typeof version === "string" && PRERELEASE_SEMVER_PATTERN.test(version)) {
    return [`Stable release requires a stable version, received ${version}.`];
  }

  return [
    `Stable release requires an X.Y.Z version, received ${String(version)}.`,
  ];
};

export const validateStableReleaseVersions = ({
  packageVersion,
  lockfileVersion,
  lockfileRootVersion,
  appVersion,
}) => {
  const errors = validateStableVersion(packageVersion);
  const sources = [
    ["package-lock", lockfileVersion],
    ["package-lock root package", lockfileRootVersion],
    ["APP_VERSION", appVersion],
  ];

  for (const [source, version] of sources) {
    if (version !== packageVersion) {
      errors.push(
        `Version mismatch: ${source} is ${String(version)}, expected ${String(packageVersion)}.`,
      );
    }
  }

  return errors;
};
