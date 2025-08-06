export interface Message {
  role: string;
  content: string;
}

const DEFAULT_MEMORY_LIMIT = 20;

class UserMemoryStore {
  private memory: Map<string, Message[]> = new Map();
  private limit: number;

  constructor(limit: number = DEFAULT_MEMORY_LIMIT) {
    this.limit = limit;
  }

  /**
   * Obtiene el historial de un usuario.
   */
  get(userId: string): Message[] {
    return this.memory.get(userId) ?? [];
  }

  /**
   * Agrega un nuevo mensaje al historial del usuario.
   */
  append(userId: string, message: Message): void {
    const history = this.get(userId);
    history.push(message);

    // Mantener el historial dentro del límite
    if (history.length > this.limit) {
      history.splice(0, history.length - this.limit);
    }

    this.memory.set(userId, history);
  }

  /**
   * Reemplaza completamente el historial de un usuario.
   */
  set(userId: string, messages: Message[]): void {
    const trimmed = messages.slice(-this.limit);
    this.memory.set(userId, trimmed);
  }

  /**
   * Borra la memoria de un usuario.
   */
  clear(userId: string): void {
    this.memory.delete(userId);
  }

  /**
   * Borra toda la memoria de todos los usuarios.
   */
  clearAll(): void {
    this.memory.clear();
  }
}

export const userMemory = new UserMemoryStore();
