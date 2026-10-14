declare module "pg" {
  export class Pool {
    constructor(config?: any);
    query(text: string, params?: any[]): Promise<{rows: any[]}>;
    end(): Promise<void>;
    connect(): Promise<any>;
  }
}
