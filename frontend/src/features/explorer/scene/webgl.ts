export interface WebGLSupportResult {
  supported: boolean;
  webgl2: boolean;
  renderer?: string;
  vendor?: string;
  error?: string;
}

export function checkWebGLSupport(): WebGLSupportResult {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { supported: false, webgl2: false, error: 'Server-side / non-browser environment' };
  }

  try {
    const canvas = document.createElement('canvas');
    let gl: RenderingContext | null = null;
    let isWebGL2 = false;

    gl = canvas.getContext('webgl2');
    if (gl) {
      isWebGL2 = true;
    } else {
      gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    }

    if (!gl) {
      return {
        supported: false,
        webgl2: false,
        error: 'WebGL not supported or disabled in your browser.',
      };
    }

    const glContext = gl as WebGLRenderingContext;
    const debugInfo = glContext.getExtension('WEBGL_debug_renderer_info');
    const renderer = debugInfo
      ? glContext.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
      : glContext.getParameter(glContext.RENDERER);
    const vendor = debugInfo
      ? glContext.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)
      : glContext.getParameter(glContext.VENDOR);

    return {
      supported: true,
      webgl2: isWebGL2,
      renderer: String(renderer || 'Unknown GPU'),
      vendor: String(vendor || 'Unknown Vendor'),
    };
  } catch (err) {
    return {
      supported: false,
      webgl2: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
