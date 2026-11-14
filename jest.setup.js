/**
 * Jest setup - Carrega variáveis de ambiente necessárias para testes
 */
const path = require('path');
const fs = require('fs');

// Carregar .env.local se existir (para testes que precisam de DEMO_JWT_SECRET)
const envLocalPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath });
}

// Também carregar .env como fallback
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Mock para localStorage (necessário para componentes Next.js)
const localStorageMock = {
  store: {},
  getItem: jest.fn((key) => localStorageMock.store[key] || null),
  setItem: jest.fn((key, value) => {
    localStorageMock.store[key] = value;
  }),
  removeItem: jest.fn((key) => {
    delete localStorageMock.store[key];
  }),
  clear: jest.fn(() => {
    localStorageMock.store = {};
  }),
};

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
});

// Mock para matchMedia (necessário para tema/dark mode)
Object.defineProperty(global, 'matchMedia', {
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock para clipboard API
if (typeof navigator !== 'undefined') {
  Object.assign(navigator, {
    clipboard: {
      writeText: jest.fn().mockResolvedValue(undefined),
      readText: jest.fn().mockResolvedValue(''),
    },
  });
}
// Mock para ResizeObserver (necessário para alguns componentes)
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock para Headers (necessário para next/server/NextRequest)
// Mock para TextEncoder (necessário para pg crypto)
if (!global.TextEncoder) {
  global.TextEncoder = class TextEncoder {
    encode(input) {
      const str = String(input);
      const result = new Uint8Array(str.length);
      for (let i = 0; i < str.length; i++) {
        result[i] = str.charCodeAt(i);
      }
      return result;
    }
    encodeInto() {
      return { read: 0, written: 0 };
    }
  };
}

// Mock para TextDecoder (necessário para pg crypto)
if (!global.TextDecoder) {
  global.TextDecoder = class TextDecoder {
    decode(input) {
      return String.fromCharCode.apply(null, new Uint8Array(input));
    }
  };
}

if (!global.Headers) {
  global.Headers = class Headers {
    constructor(init = {}) {
      if (typeof init === 'string') {
        // Parse header string
        this._headers = new Map();
        init.split('\r\n').forEach(line => {
          if (line) {
            const [name, value] = line.split(': ');
            if (name && value) this._headers.set(name.toLowerCase(), value);
          }
        });
      } else {
        this._headers = new Map();
        if (init instanceof Headers) {
          init._headers.forEach((value, key) => this._headers.set(key, value));
        } else if (init) {
          Object.entries(init).forEach(([key, value]) => {
            this._headers.set(key.toLowerCase(), value);
          });
        }
      }
    }
    get(name) {
      return this._headers.get(name.toLowerCase()) || null;
    }
    set(name, value) {
      this._headers.set(name.toLowerCase(), value);
    }
    append(name, value) {
      const existing = this._headers.get(name.toLowerCase());
      if (existing) {
        this._headers.set(name.toLowerCase(), existing + ',' + value);
      } else {
        this._headers.set(name.toLowerCase(), value);
      }
    }
    has(name) {
      return this._headers.has(name.toLowerCase());
    }
    delete(name) {
      this._headers.delete(name.toLowerCase());
    }
    entries() {
      return this._headers.entries();
    }
    forEach(callback, thisArg) {
      this._headers.forEach((value, key) => {
        callback.call(thisArg, value, key, this);
      });
    }
    [Symbol.iterator]() {
      return this._headers.entries();
    }
  };
}

// Mock para Request (necessário para next/server/NextRequest)
// Nota: Este mock é compatível com a API Web standard e o Next.js NextRequest
if (!global.Request) {
  global.Request = class Request {
    constructor(url, init = {}) {
      // Usar Object.defineProperty para url pois é somente leitura na API Web
      Object.defineProperty(this, 'url', {
        value: typeof url === 'string' ? url : url.toString(),
        writable: false,
        enumerable: true,
        configurable: true,
      });

      this.method = init.method || 'GET';
      this.headers = new Headers(init.headers || {});
      this.body = init.body || null;
      this._bodyInit = init.body || null;
      this.mode = init.mode || 'cors';
      this.credentials = init.credentials || 'same-origin';
      this.cache = init.cache || 'default';
      this.redirect = init.redirect || 'follow';
      this.referrer = init.referrer || '';
      this.referrerPolicy = init.referrerPolicy || '';
      this.priority = init.priority || '';
      this.protocol = url.startsWith('https') ? 'https:' : 'http:';
      this.destination = init.destination || '';
    }

    get json() {
      return this.headers.get('content-type')?.includes('json') || false;
    }

    json() {
      try {
        return Promise.resolve(JSON.parse(this._bodyInit || 'null'));
      } catch (e) {
        return Promise.reject(new TypeError('Invalid JSON'));
      }
    }

    text() {
      return Promise.resolve(this._bodyInit || '');
    }

    arrayBuffer() {
      return Promise.resolve(Buffer.from(this._bodyInit || '').arrayBuffer());
    }

    clone() {
      return new Request(this.url, {
        method: this.method,
        headers: this.headers,
        body: this._bodyInit,
        ...this,
      });
    }

    static of(request, init = {}) {
      return new Request(request, init);
    }

    static append(headers, name, value) {
      headers.append(name, value);
    }
  };
}

// Mock para Response (necessário para next/server/NextResponse)
if (!global.Response) {
  global.Response = class Response {
    constructor(body, init = {}) {
      this.body = body;
      this.status = init.status !== undefined ? init.status : 200;
      this.ok = this.status >= 200 && this.status < 300;
      this.statusText = init.statusText || '';
      this.headers = new Headers(init.headers || {});
      this.url = init.url || '';
      this.type = init.type || 'default';
      this.redirected = false;
      this.version = 'HTTP/1.1';
      this._bodyInit = typeof body === 'string' ? body :
                       typeof body === 'object' && body !== null && !(body instanceof ReadableStream) ? JSON.stringify(body) : body;
    }

    json() {
      if (typeof this.body === 'object' && this.body !== null && !(this.body instanceof ReadableStream)) return Promise.resolve(this.body);
      try {
        return Promise.resolve(JSON.parse(this.body));
      } catch (e) {
        return Promise.reject(new TypeError('Invalid JSON'));
      }
    }

    text() {
      // Handle ReadableStream body (SSE responses)
      if (this.body instanceof ReadableStream) {
        // For testing, we need to consume the stream
        return new Promise(async (resolve) => {
          const reader = this.body.getReader();
          let result = '';
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              // value is a Uint8Array from TextEncoder
              result += new TextDecoder().decode(value);
            }
          } catch (e) {
            // Ignore stream errors in test
          }
          resolve(result);
        });
      }
      return Promise.resolve(this.body || '');
    }

    arrayBuffer() {
      return Promise.resolve(Buffer.from(this.body || '').arrayBuffer());
    }

    blob() {
      return Promise.resolve(Buffer.from(this.body || ''));
    }

    clone() {
      return new Response(this.body, {
        status: this.status,
        headers: this.headers,
        ...this,
      });
    }

    static json(data, init = {}) {
      return new Response(JSON.stringify(data), {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...init.headers,
        },
      });
    }

    static text(text, init = {}) {
      return new Response(text, {
        ...init,
        headers: {
          'Content-Type': 'text/plain',
          ...init.headers,
        },
      });
    }

    static blob(blob, init = {}) {
      return new Response(blob.toString(), init);
    }

    static arrayBuffer(buffer, init = {}) {
      return new Response(Buffer.from(buffer).toString(), init);
    }

    static redirect(url, status = 302) {
      const response = new Response(null, { status });
      response.headers.set('Location', url);
      return response;
    }

    static error() {
      return new Response('Error', { status: 500 });
    }

    static ok() {
      return new Response('OK', { status: 200 });
    }

    static noContent() {
      return new Response(null, { status: 204 });
    }

    static from(value) {
      return value;
    }

    static response(type, body = null, init = {}) {
      return new Response(body, { type, ...init });
    }
  };
}

// Mock para ReadableStream (necessário para SSE em testes)
if (!global.ReadableStream) {
  global.ReadableStream = class ReadableStream {
    constructor(underlyingSource = {}, strategy = {}) {
      this._source = underlyingSource;
      this._strategy = strategy;
      this._controller = null;
      this._state = 'readable';
      this._queue = [];

      if (underlyingSource.start) {
        const controller = {
          enqueue: (chunk) => this._queue.push(chunk),
          close: () => { this._state = 'closed'; },
          error: (e) => { this._state = 'errored'; },
          desiredSize: 1,
        };
        this._controller = controller;
        underlyingSource.start(controller);
      }
    }

    getReader() {
      return {
        read: async () => {
          if (this._queue.length > 0) {
            return { value: this._queue.shift(), done: false };
          }
          if (this._state === 'closed') {
            return { value: undefined, done: true };
          }
          // Wait for more data or close
          return new Promise((resolve) => {
            const check = () => {
              if (this._queue.length > 0) {
                resolve({ value: this._queue.shift(), done: false });
              } else if (this._state === 'closed') {
                resolve({ value: undefined, done: true });
              } else {
                setTimeout(check, 10);
              }
            };
            check();
          });
        },
        releaseLock: () => {},
      };
    }

    pipeTo() {}
    pipeThrough() {}
    tee() { return [this, this]; }
    cancel() {}
  };
}

// Mock para ReadableStreamDefaultReader (para compatibilidade)
if (!global.ReadableStreamDefaultReader) {
  global.ReadableStreamDefaultReader = class ReadableStreamDefaultReader {
    constructor(stream) {
      this._stream = stream;
    }
    read() { return this._stream.getReader().read(); }
    releaseLock() { return this._stream.getReader().releaseLock(); }
  };
}
