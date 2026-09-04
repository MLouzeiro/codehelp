declare module 'csurf' {
  import { RequestHandler } from 'express';
  interface CsurfOptions {
    cookie?: boolean | { key?: string; path?: string; httpOnly?: boolean; secure?: boolean; sameSite?: string | boolean };
    ignoreMethods?: string[];
    value?: (req: any) => string;
  }
  function csurf(options?: CsurfOptions): RequestHandler;
  export default csurf;
}
