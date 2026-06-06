declare module '@prisma/client' {
  interface Ticket {
    dataConclusao: Date | null;
  }
}

declare module '@prisma/client/runtime/library' {
  interface Ticket {
    dataConclusao: Date | null;
  }
}

declare module '@prisma/client' {
  interface PrismaClient {
    automationRule: any;
  }
}

declare module '@prisma/client/runtime/library' {
  interface PrismaClient {
    automationRule: any;
  }
}

export {};
