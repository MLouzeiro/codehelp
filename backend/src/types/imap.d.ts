declare module 'imap' {
  import { EventEmitter } from 'events';

  interface ImapConfig {
    user: string;
    password: string;
    host: string;
    port: number;
    tls?: boolean;
    tlsOptions?: { rejectUnauthorized?: boolean };
    connTimeout?: number;
    authTimeout?: number;
  }

  interface FetchOptions {
    bodies?: string | string[];
    markSeen?: boolean;
    struct?: boolean;
    envelope?: boolean;
    size?: boolean;
  }

  interface Box {
    name: string;
    flags: string[];
    messages: { total: number; new: number; unseen: number };
  }

  class Connection extends EventEmitter {
    constructor(config: ImapConfig);
    connect(): void;
    end(): void;
    openBox(boxName: string, readOnly: boolean, callback: (err: Error | null, box: Box) => void): void;
    search(criteria: any[], callback: (err: Error | null, results: number[]) => void): void;
    fetch(source: number | number[], options: FetchOptions): any;
    addFlags(uid: number | number[], flags: string | string[], callback?: (err: Error | null) => void): void;
    delFlags(uid: number | number[], flags: string | string[], callback?: (err: Error | null) => void): void;
    addBox(boxName: string, callback: (err: Error | null) => void): void;
    delBox(boxName: string, callback: (err: Error | null) => void): void;
  }

  export default Connection;
  export { ImapConfig, FetchOptions, Box, Connection };
}
