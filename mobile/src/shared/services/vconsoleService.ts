export interface VConsoleEnvironment {
  DEV?: boolean;
  VITE_VCONSOLE_ENABLED?: string;
  MODE?: string;
}

interface VConsoleInstance {
  destroy(): void;
  setSwitchPosition(x: number, y: number): void;
  show(): void;
  showSwitch(): void;
}

interface VConsoleConstructor {
  new (options?: {
    defaultPlugins?: Array<'system' | 'network' | 'element' | 'storage'>;
    network?: {
      ignoreUrlRegExp?: RegExp;
    };
  }): VConsoleInstance;
}

type VConsoleLoader = () => Promise<{ default: VConsoleConstructor }>;

const sensitiveAuthRequestPattern = /\/(?:v\d+\/)?auth(?:\/|$|\?)/i;
const bundledVConsoleLoader: VConsoleLoader | null =
  import.meta.env.MODE === 'production' || import.meta.env.MODE === 'release'
    ? null
    : () => import('vconsole');
let vconsoleInstance: VConsoleInstance | null = null;

function isReleaseMode(mode: string | undefined) {
  const normalizedMode = mode?.trim().toLowerCase();

  return normalizedMode === 'production' || normalizedMode === 'release';
}

export function shouldEnableVConsole(env: VConsoleEnvironment) {
  if (isReleaseMode(env.MODE)) {
    return false;
  }

  return env.VITE_VCONSOLE_ENABLED?.trim().toLowerCase() === 'true';
}

export function isDebugDiagnosticsEnabled(
  env: VConsoleEnvironment = import.meta.env
) {
  return Boolean(env.DEV) || shouldEnableVConsole(env);
}

export async function initializeVConsole(
  env: VConsoleEnvironment = import.meta.env,
  loadVConsole: VConsoleLoader | null = bundledVConsoleLoader
) {
  // Keep release builds free of the debug panel even if an environment value
  // is accidentally set. Vite can also remove this branch during production
  // builds because MODE is replaced at build time.
  if (
    import.meta.env.MODE === 'production' ||
    import.meta.env.MODE === 'release'
  ) {
    return false;
  }

  if (!shouldEnableVConsole(env) || !loadVConsole) {
    return false;
  }

  if (vconsoleInstance) {
    vconsoleInstance.showSwitch();
    vconsoleInstance.show();
    return true;
  }

  try {
    const { default: VConsole } = await loadVConsole();
    const instance = new VConsole({
      defaultPlugins: ['system', 'network'],
      network: {
        ignoreUrlRegExp: sensitiveAuthRequestPattern,
      },
    });

    instance.setSwitchPosition(12, 72);
    instance.showSwitch();
    instance.show();
    vconsoleInstance = instance;

    return true;
  } catch {
    // Debug tooling must never prevent the app from starting.
    console.warn('OurWeek vConsole could not be initialized.');
    return false;
  }
}

export function destroyVConsole() {
  vconsoleInstance?.destroy();
  vconsoleInstance = null;
}
